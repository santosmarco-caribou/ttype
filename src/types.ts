import cloneDeep from 'clone-deep'
import type { Dayjs } from 'dayjs'
import mergeDeep from 'merge-deep'
import memoize from 'micro-memoize'
import type { N } from 'ts-toolbelt'
import type {
  LiteralUnion,
  OmitIndexSignature,
  PositiveInfinity,
  RequireAtLeastOne,
} from 'type-fest'
import { IssueKind, type Issue, type checks } from './issues'
import {
  ParseContext,
  TParsedType,
  type AsyncParseResultOf,
  type ParseContextOf,
  type ParseOptions,
  type ParsePath,
  type ParseResult,
  type ParseResultOf,
  type SyncParseResult,
  type SyncParseResultOf,
} from './parse'
import { utils } from './utils'

export interface TDef {
  readonly typeName: TTypeName
  readonly checks?: readonly { readonly kind: string }[]
}

export abstract class TType<O, Def extends TDef, I = O> {
  readonly _O!: O
  readonly _I!: I

  protected readonly _def: Def

  protected constructor(def: Def) {
    this._def = def

    this._parse = memoize(this._parse.bind(this))
    this._parseSync = memoize(this._parseSync.bind(this))
    this._parseAsync = memoize(this._parseAsync.bind(this))
    this.safeParse = this.safeParse.bind(this)
    this.parse = this.parse.bind(this)
    this.safeParseAsync = this.safeParseAsync.bind(this)
    this.parseAsync = this.parseAsync.bind(this)
    this.is = this.is.bind(this)
    this.guard = this.guard.bind(this)
    this.optional = this.optional.bind(this)
    this.nullable = this.nullable.bind(this)
    this.nullish = this.nullish.bind(this)
    this.or = this.or.bind(this)
    this.array = this.array.bind(this)
    this.promise = this.promise.bind(this)
    this.brand = this.brand.bind(this)
    this.default = this.default.bind(this)
    this.catch = this.catch.bind(this)
    this.lazy = this.lazy.bind(this)
    this.refine = this.refine.bind(this)
    this.transform = this.transform.bind(this)
    this.preprocess = this.preprocess.bind(this)

    Object.keys(Object.getOwnPropertyDescriptors(this))
      .filter((key) => key.match(/^\$?_/))
      .forEach((key) => Object.defineProperty(this, key, { enumerable: false }))
  }

  get typeName(): Def['typeName'] {
    return this._def.typeName
  }

  abstract readonly hint: string

  abstract _parse(ctx: ParseContext<unknown, O, I>): ParseResultOf<this>

  _parseSync(ctx: ParseContext<unknown, O, I>): SyncParseResultOf<this> {
    const result = this._parse(ctx)
    if (result instanceof Promise) {
      throw new Error('Synchronous parse encountered promise')
    }
    return result
  }

  async _parseAsync(
    ctx: ParseContext<unknown, O, I>
  ): Promise<SyncParseResultOf<this>> {
    const result = this._parse(ctx)
    return result
  }

  safeParse(data: unknown, options?: ParseOptions): SyncParseResultOf<this> {
    const parseContext = ParseContext.createSync(this, data, options)
    return this._parseSync(parseContext)
  }

  parse(data: unknown, options?: ParseOptions): O {
    const result = this.safeParse(data, options)
    if (result.ok) return result.data
    else throw result.error
  }

  safeParseAsync(
    data: unknown,
    options?: ParseOptions
  ): AsyncParseResultOf<this> {
    const parseContext = ParseContext.createAsync(this, data, options)
    return this._parseAsync(parseContext)
  }

  async parseAsync(data: unknown, options?: ParseOptions): Promise<O> {
    const result = await this.safeParseAsync(data, options)
    if (result.ok) return result.data
    else throw result.error
  }

  is(data: unknown): data is O {
    return this.safeParse(data).ok
  }

  guard(data: unknown): data is O {
    return this.is(data)
  }

  optional(): TOptional<this> {
    return TOptional.create(this)
  }

  nullable(): TNullable<this> {
    return TNullable.create(this)
  }

  nullish(): TOptional<TNullable<this>> {
    return this.nullable().optional()
  }

  or<T extends [AnyTType, ...AnyTType[]]>(
    ...types: T
  ): TUnion<[this, T[0], ...utils.Tail<T>]> {
    return TUnion.create([this, types[0], ...utils.tail(types)])
  }

  array(): TArray<this> {
    return TArray.create(this)
  }

  promise(): TPromise<this> {
    return TPromise.create(this)
  }

  brand<B extends PropertyKey>(brand: B): TBranded<this, B> {
    return TBranded.create(this, brand)
  }

  default<D extends utils.Defined<I>>(
    defaultValue: D | (() => D)
  ): TDefault<this, D> {
    return TDefault.create(this, defaultValue)
  }

  catch<C extends I>(catchValue: C | (() => C)): TCatch<this, C> {
    return TCatch.create(this, catchValue)
  }

  lazy(): TLazy<this> {
    return TLazy.create(() => this)
  }

  refine<O_ extends O>(
    check: (data: O) => data is O_,
    message?: RefinementMsgArg<O>
  ): TEffects<this, O_, I>
  refine<T>(
    check: (data: O) => T | Promise<T>,
    message?: RefinementMsgArg<O>
  ): TEffects<this, O, I>
  refine(
    check: (data: O) => unknown | Promise<unknown>,
    message?: RefinementMsgArg<O>
  ): TEffects<this, O, I> {
    return TEffects.refine(this, check, message)
  }

  transform<O_>(
    transform: (data: O, ctx: EffectContext<O>) => O_ | Promise<O_>
  ): TEffects<this, O_, I> {
    return TEffects.transform(this, transform)
  }

  preprocess(preprocess: (data: unknown) => O): TEffects<this, O, I> {
    return TEffects.preprocess(preprocess, this)
  }

  protected _addCheck<K extends utils.Defined<Def['checks']>[number]['kind']>(
    kind: K,
    payload: Omit<
      Extract<utils.Defined<Def['checks']>[number], { readonly kind: K }>,
      'kind'
    > & { readonly message: string | undefined }
  ): this {
    return this._construct({
      checks: (this._def.checks ?? [])
        .filter((c) => c.kind === kind)
        .concat({ kind, ...payload }),
    })
  }

  protected _removeChecks<
    K extends utils.Defined<Def['checks']>[number]['kind']
  >(checks: readonly [K, ...K[]]): this {
    return this._construct({
      checks: (this._def.checks ?? []).filter((c) =>
        utils.includes(checks, c.kind)
      ),
    })
  }

  protected _construct(def: Partial<TDef>): this {
    return Reflect.construct(this.constructor as new (def: Def) => this, [
      mergeDeep(cloneDeep(this._def), def),
    ])
  }
}

export type AnyTType<O = unknown, I = O> = TType<O, TDef, I>

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                        Array                                                       */
/* ------------------------------------------------------------------------------------------------------------------ */

export type TArrayCheck =
  | checks.Min
  | checks.Max
  | checks.Length
  | checks.SortAscending
  | checks.SortDescending

export interface TArrayState {
  min: number
  max: number
}

export interface TArrayInitialState extends TArrayState {
  min: 0
  max: PositiveInfinity
}

type ComputeNextTArrayState<
  CurrState extends TArrayState,
  Method extends 'min' | 'max',
  Value extends number,
  Inclusive extends boolean
> = utils.Simplify<
  {
    [K in Method]: 'min' extends K
      ? { 0: Value; 1: N.Add<Value, 1> }[utils.Equals<Inclusive, false>]
      : 'max' extends K
      ? { 0: Value; 1: N.Sub<Value, 1> }[utils.Equals<Inclusive, false>]
      : never
  } & {
    [K in Exclude<'min' | 'max', Method>]: {
      0: CurrState[K]
      1: TArrayInitialState[K]
    }[utils.Equals<CurrState['min'], CurrState['max']>]
  }
>

export type TArrayIO<
  T extends AnyTType,
  S extends TArrayState,
  IO extends '_I' | '_O'
> = PositiveInfinity extends S['max']
  ? T[IO][]
  : utils.Equals<S['min'], S['max']> extends 1
  ? [...utils.ConstructTuple<T[IO], S['min']>, ...never[]]
  : [
      ...utils.ConstructTuple<T[IO], S['min']>,
      ...utils.PartialTuple<
        utils.ConstructTuple<T[IO], N.Sub<S['max'], S['min']>>
      >,
      ...never[]
    ]

export interface TArrayDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Array
  readonly checks: readonly TArrayCheck[]
  readonly element: T
}

export class TArray<
  T extends AnyTType,
  S extends TArrayState = TArrayInitialState
> extends TType<TArrayIO<T, S, '_O'>, TArrayDef<T>, TArrayIO<T, S, '_I'>> {
  readonly hint = `Array<${this.element.hint}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!Array.isArray(ctx.data)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Array }).ABORT()
    }

    for (const check of this._def.checks) {
      switch (check.kind) {
        case 'min':
          if (
            (check.inclusive && ctx.data.length < check.value) ||
            (!check.inclusive && ctx.data.length <= check.value)
          ) {
            ctx.DIRTY(IssueKind.InvalidArray, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'max':
          if (
            (check.inclusive && ctx.data.length > check.value) ||
            (!check.inclusive && ctx.data.length >= check.value)
          ) {
            ctx.DIRTY(IssueKind.InvalidArray, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'length':
          if (ctx.data.length !== check.value) {
            ctx.DIRTY(IssueKind.InvalidArray, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'sort_ascending':
          const sortedAsc = [...ctx.data].sort()
          if (check.convert) {
            ctx.setData(sortedAsc)
          } else if (ctx.data.some((item, idx) => sortedAsc[idx] !== item)) {
            ctx.DIRTY(IssueKind.InvalidArray, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'sort_descending':
          const sortedDesc = [...ctx.data].sort().reverse()
          if (check.convert) {
            ctx.setData(sortedDesc)
          } else if (ctx.data.some((item, idx) => sortedDesc[idx] !== item)) {
            ctx.DIRTY(IssueKind.InvalidArray, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
      }
    }

    const entries = [...ctx.data.entries()]
    const result: unknown[] = []

    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        for (const [index, value] of entries) {
          const parseResult = await this.element._parseAsync(
            ctx.child({ ttype: this.element, data: value, path: [index] })
          )
          if (parseResult.ok) {
            result.push(parseResult.data)
          } else {
            if (ctx.common.abortEarly) {
              return parseResult
            }
          }
        }
        return ctx.isValid()
          ? ctx.OK(result as TArrayIO<T, S, '_O'>)
          : ctx.ABORT()
      })
    } else {
      for (const [index, value] of entries) {
        const parseResult = this.element._parseSync(
          ctx.child({ ttype: this.element, data: value, path: [index] })
        )
        if (parseResult.ok) {
          result.push(parseResult.data)
        } else {
          if (ctx.common.abortEarly) {
            return parseResult
          }
        }
      }
      return ctx.isValid()
        ? ctx.OK(result as TArrayIO<T, S, '_O'>)
        : ctx.ABORT()
    }
  }

  get element(): T {
    return this._def.element
  }

  /**
   * Specifies the minimum number of items in the array where:
   *
   * @param value - The lowest number of array items allowed.
   */
  min<V extends number, I extends boolean = true>(
    value: V,
    options?: { readonly inclusive?: I; readonly message?: string },
    ..._errors: [
      ...utils.$ValidateNonNegativeInteger<V>,
      ...{
        0: utils.$ValidateAgainstNumeric<
          { value: V; label: 'min' },
          '<=',
          { value: S['max']; label: 'max' }
        >
        1: []
      }[utils.Equals<S['min'], S['max']>]
    ]
  ): TArray<T, ComputeNextTArrayState<S, 'min', V, I>> {
    return this._addCheck('min', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeChecks(['length']) as unknown as TArray<
      T,
      ComputeNextTArrayState<S, 'min', V, I>
    >
  }

  /**
   * Specifies the maximum number of items in the array where:
   *
   * @param value - The highest number of array items allowed.
   */
  max<V extends number, I extends boolean = true>(
    value: V,
    options?: { readonly inclusive?: I; readonly message?: string },
    ..._errors: [
      ...utils.$ValidateNonNegativeInteger<false extends I ? N.Sub<V, 1> : V>,
      ...{
        0: utils.$ValidateAgainstNumeric<
          { value: false extends I ? N.Sub<V, 1> : V; label: 'max' },
          '>=',
          { value: S['min']; label: 'min' }
        >
        1: []
      }[utils.Equals<S['min'], S['max']>]
    ]
  ): TArray<T, ComputeNextTArrayState<S, 'max', V, I>> {
    return this._addCheck('max', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeChecks(['length']) as unknown as TArray<
      T,
      ComputeNextTArrayState<S, 'max', V, I>
    >
  }

  /**
   * Specifies the exact number of items in the array where:
   *
   * @param value - The number of array items allowed.
   */
  length<V extends number>(
    value: V,
    options?: { readonly message?: string },
    ..._errors: utils.$ValidateNonNegativeInteger<V>
  ): TArray<T, { min: V; max: V }> {
    return this._addCheck('length', {
      value,
      message: options?.message,
    })._removeChecks(['min', 'max']) as unknown as TArray<T, { min: V; max: V }>
  }

  /**
   * Requires the array to comply with the `ascending` sort order.
   *
   * @param options - Options for this check.
   * @param options.convert - When `true`, the array is modified to match the sort order.
   * Defaults to `false`.
   * @param options.message - The error message to use.
   */
  ascending(options?: {
    readonly convert?: boolean
    readonly message?: string
  }): this {
    return this._addCheck('sort_ascending', {
      direction: 'ascending',
      convert: options?.convert ?? false,
      message: options?.message,
    })._removeChecks(['sort_descending'])
  }

  /**
   * Requires the array to comply with the `descending` sort order.
   *
   * @param options - Options for this check.
   * @param options.convert - When `true`, the array is modified to match the sort order.
   * Defaults to `false`.
   * @param options.message - The error message to use.
   */
  descending(options?: {
    readonly convert?: boolean
    readonly message?: string
  }): this {
    return this._addCheck('sort_descending', {
      direction: 'descending',
      convert: options?.convert ?? false,
      message: options?.message,
    })._removeChecks(['sort_ascending'])
  }

  /**
   * Flattens this `TArray` one level deep (if applicable).
   */
  flatten(): T extends AnyTArray ? T : this {
    return (
      this.element instanceof TArray ? this.element : this
    ) as T extends AnyTArray ? T : this
  }

  static create = <T extends AnyTType>(
    element: T
  ): TArray<T, TArrayInitialState> =>
    new TArray({ typeName: TTypeName.Array, checks: [], element })
}

export type AnyTArray = TArray<AnyTType, TArrayInitialState>

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                        Enum                                                        */
/* ------------------------------------------------------------------------------------------------------------------ */

export type EnumValue = string | number
export type EnumValues<T extends EnumValue = EnumValue> = readonly [T, ...T[]]

export type EnumLike = {
  readonly [x: string]: string | number
  readonly [x: number]: string
}

export type CastToEnumValuesTuple<T> = T extends EnumValues ? T : never
export type UnionToTupleEnumValues<T> = CastToEnumValuesTuple<
  utils.UnionToTuple<T>
>

export type CastToPrimitive<T extends string | number> =
  `${T}` extends `${infer N extends number}` ? N : `${T}`

export type ExtractedEnum<
  K extends EnumValue,
  U extends Record<string | number, string | number>
> = TEnum<
  UnionToTupleEnumValues<CastToPrimitive<K>>,
  { [K_ in keyof U as U[K_] extends K ? K_ : never]: U[K_] }
>
export type ExcludedEnum<
  K extends EnumValue,
  T extends EnumValues,
  U extends Record<string | number, string | number>
> = TEnum<
  UnionToTupleEnumValues<Exclude<T[number], CastToPrimitive<K>>>,
  { [K_ in keyof U as U[K_] extends K ? never : K_]: U[K_] }
>

export const getValidEnumObject = (obj: any) =>
  Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => typeof obj[obj[k]] !== 'number')
      .map(([k]) => [k, obj[k]])
  )

const getEnumTypes = (values: EnumValues) => [
  ...new Set(
    values
      .map((value) => typeof value)
      .filter((type): type is 'string' | 'number' =>
        utils.includes(['string', 'number'], type)
      )
  ),
]

const isEnumValue = (
  types: readonly ('string' | 'number')[],
  data: unknown
): data is EnumValue => utils.includes(types, typeof data)

export type TEnumHint<T extends EnumValues> = T extends readonly [
  infer H extends EnumValue,
  ...infer R
]
  ? `${utils.Literalized<H>}${R extends [infer I extends string | number]
      ? ` | ${utils.Literalized<I>}`
      : R extends EnumValues
      ? ` | ${TEnumHint<R>}`
      : never}`
  : never

export interface TEnumCreateFn {
  <T extends EnumValue, U extends EnumValues<T>>(values: U): TEnum<
    Readonly<U>,
    { readonly [K in U[number]]: K }
  >
  <T extends EnumLike>(enum_: T): TEnum<
    UnionToTupleEnumValues<CastToPrimitive<T[keyof T]>>,
    OmitIndexSignature<{ readonly [K in keyof T]: T[K] }> extends infer X
      ? { [K in keyof X]: X[K] }
      : never
  >
}

export interface TEnumDef<
  T extends EnumValues,
  U extends Record<string | number, string | number>
> extends TDef {
  readonly typeName: TTypeName.Enum
  readonly values: T
  readonly enum: U
}

export class TEnum<
  T extends EnumValues,
  U extends Record<string | number, string | number>
> extends TType<T[number], TEnumDef<T, U>> {
  readonly hint = this.values.map(utils.literalize).join(' | ') as TEnumHint<T>

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const types = getEnumTypes(this.values)

    if (!isEnumValue(types, ctx.data)) {
      return ctx
        .INVALID_TYPE({
          expected:
            types.length === 1
              ? { string: TParsedType.String, number: TParsedType.Number }[
                  types[0]
                ]
              : TParsedType.EnumValue,
        })
        .ABORT()
    }

    if (!utils.includes(this.values, ctx.data)) {
      return ctx
        .INVALID_ENUM_VALUE({ expected: this.values, received: ctx.data })
        .ABORT()
    }

    return ctx.OK(ctx.data)
  }

  get values(): T {
    return this._def.values
  }

  get enum(): U {
    return this._def.enum
  }

  extract<K extends T[number]>(
    ...keys: readonly [K, ...K[]]
  ): ExtractedEnum<K, U>
  extract<K extends T[number]>(keys: readonly [K, ...K[]]): ExtractedEnum<K, U>
  extract<K extends T[number]>(...keys: readonly [K, ...K[]]) {
    return new TEnum({
      ...this._def,
      typeName: TTypeName.Enum,
      values: keys as any,
      enum: Object.fromEntries(
        Object.entries(this.enum).filter(([key]) =>
          utils.includes(keys, this.enum[key])
        )
      ) as any,
    })
  }

  exclude<K extends T[number]>(
    ...keys: readonly [K, ...K[]]
  ): ExcludedEnum<K, T, U>
  exclude<K extends T[number]>(
    keys: readonly [K, ...K[]]
  ): ExcludedEnum<K, T, U>
  exclude<K extends T[number]>(...keys: readonly [K, ...K[]]) {
    const excludedKeys = Array.isArray(keys[0]) ? keys[0] : keys
    return new TEnum({
      ...this._def,
      typeName: TTypeName.Enum,
      values: this.values.filter(
        (value) => !utils.includes(excludedKeys, value)
      ) as any,
      enum: Object.fromEntries(
        Object.entries(this.enum).filter(
          ([key]) => !utils.includes(excludedKeys, this.enum[key])
        )
      ) as any,
    })
  }

  static create: TEnumCreateFn = (valuesOrEnum: EnumValues | EnumLike) =>
    new TEnum({
      typeName: TTypeName.Enum,
      values: (Array.isArray(valuesOrEnum)
        ? valuesOrEnum
        : Object.values(getValidEnumObject(valuesOrEnum))) as any,
      enum: Array.isArray(valuesOrEnum)
        ? Object.fromEntries(valuesOrEnum.map((val) => [val, val]))
        : getValidEnumObject(valuesOrEnum),
    })
}

export type AnyTEnum = TEnum<
  EnumValues,
  Record<string | number, string | number>
>

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                     Any                                    */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TAnyDef extends TDef {
  readonly typeName: TTypeName.Any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TAny extends TType<any, TAnyDef> {
  readonly hint = 'any'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.OK(ctx.data)
  }

  static create = (): TAny => new TAny({ typeName: TTypeName.Any })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                   Unknown                                  */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TUnknownDef extends TDef {
  readonly typeName: TTypeName.Unknown
}

export class TUnknown extends TType<unknown, TUnknownDef> {
  readonly hint = 'unknown'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.OK(ctx.data)
  }

  static create = (): TUnknown => new TUnknown({ typeName: TTypeName.Unknown })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                   BigInt                                   */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TBigIntDef extends TDef {
  readonly typeName: TTypeName.BigInt
}

export class TBigInt extends TType<bigint, TBigIntDef> {
  readonly hint = 'bigint'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return typeof ctx.data === 'bigint'
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.BigInt }).ABORT()
  }

  static create = (): TBigInt => new TBigInt({ typeName: TTypeName.BigInt })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                     NaN                                    */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TNaNDef extends TDef {
  readonly typeName: TTypeName.NaN
}

export class TNaN extends TType<number, TNaNDef> {
  readonly hint = 'NaN'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return typeof ctx.data === 'number' && Number.isNaN(ctx.data)
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.NaN }).ABORT()
  }

  static create = (): TNaN => new TNaN({ typeName: TTypeName.NaN })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                   Boolean                                  */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TBooleanState {
  coerce:
    | { true?: readonly utils.Primitive[]; false?: readonly utils.Primitive[] }
    | boolean
}

export type TBooleanInput<S extends TBooleanState> = S['coerce'] extends false
  ? boolean
  : S['coerce'] extends true
  ? unknown
  : S['coerce'] extends { true?: infer Truthy; false?: infer Falsy }
  ?
      | utils.Defined<Truthy[number & keyof Truthy]>
      | utils.Defined<Falsy[number & keyof Falsy]>
  : boolean

export interface TBooleanDef extends TDef, TBooleanState {
  readonly typeName: TTypeName.Boolean
}

export class TBoolean<S extends TBooleanState = TBooleanState> extends TType<
  boolean,
  TBooleanDef,
  TBooleanInput<S>
> {
  readonly hint = 'boolean'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const { coerce } = this._def

    if (coerce === true) {
      ctx.setData(Boolean(ctx.data))
    } else if (coerce && utils.isPrimitive(ctx.data)) {
      if ((coerce.true ?? []).includes(ctx.data)) {
        ctx.setData(true)
      } else if ((coerce.false ?? []).includes(ctx.data)) {
        ctx.setData(false)
      }
    }

    return typeof ctx.data === 'boolean'
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.Boolean }).ABORT()
  }

  /**
   * Enables/disables coercion on the schema, and/or allows for additional values
   * to be considered valid booleans by converting them to `true`/`false` before parsing.
   *
   * @param coercion - The coercion options.
   */
  coerce<
    TVal extends utils.Primitive,
    FVal extends utils.Primitive,
    T extends readonly [TVal, ...TVal[]] | undefined = undefined,
    F extends readonly [FVal, ...FVal[]] | undefined = undefined,
    B extends boolean = true
  >(
    coercion: { readonly true?: T; readonly false?: F } | B = true as B
  ): TBoolean<{ coerce: boolean extends B ? { true: T; false: F } : B }> {
    return new TBoolean({ ...this._def, coerce: coercion })
  }

  /**
   * Allows for additional values to be considered valid booleans by
   * converting them to `true` before parsing.
   *
   * @param values - The values to consider truthy.
   */
  truthy<TVal extends utils.Primitive, T extends readonly [TVal, ...TVal[]]>(
    values: T
  ): TBoolean<{
    coerce: {
      true: T
      false: Exclude<S['coerce'], boolean>['false'] extends infer X extends
        | readonly utils.Primitive[]
        ? { 0: X; 1: undefined }[utils.Equals<X, never>]
        : never
    }
  }> {
    return new TBoolean({
      ...this._def,
      coerce: {
        ...(typeof this._def.coerce === 'boolean' ? {} : this._def.coerce),
        true: values,
      },
    })
  }

  /**
   * Allows for additional values to be considered valid booleans by
   * converting them to `false` before parsing.
   *
   * @param values - The values to consider falsy.
   */
  falsy<FVal extends utils.Primitive, F extends readonly [FVal, ...FVal[]]>(
    values: F
  ): TBoolean<{
    coerce: {
      true: Exclude<S['coerce'], boolean>['true'] extends infer X extends
        | readonly utils.Primitive[]
        ? { 0: X; 1: undefined }[utils.Equals<X, never>]
        : never
      false: F
    }
  }> {
    return new TBoolean({
      ...this._def,
      coerce: {
        ...(typeof this._def.coerce === 'boolean' ? {} : this._def.coerce),
        false: values,
      },
    })
  }

  static create = (): TBoolean<{ coerce: false }> =>
    new TBoolean({ typeName: TTypeName.Boolean, coerce: false })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                    True                                    */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TTrueDef extends TDef {
  readonly typeName: TTypeName.True
}

export class TTrue extends TType<true, TTrueDef> {
  readonly hint = 'true'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === true
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.True }).ABORT()
  }

  static create = (): TTrue => new TTrue({ typeName: TTypeName.True })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                    False                                   */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TFalseDef extends TDef {
  readonly typeName: TTypeName.False
}

export class TFalse extends TType<false, TFalseDef> {
  readonly hint = 'false'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === false
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.False }).ABORT()
  }

  static create = (): TFalse => new TFalse({ typeName: TTypeName.False })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                    Date                                    */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export type DateDataInput = LiteralUnion<'now', string> | number | Date | Dayjs

export type TDateCheck =
  | checks.Min<DateDataInput>
  | checks.Max<DateDataInput>
  | checks.Range<DateDataInput>

const parseDateDataInput = (data: DateDataInput) =>
  data === 'now' ? utils.dayjs() : data

export interface TDateState {
  coerce: boolean | 'strings' | 'numbers'
}

export type TDateInput<S extends TDateState> =
  | Date
  | (S['coerce'] extends true
      ? string | number
      : S['coerce'] extends 'strings'
      ? string
      : S['coerce'] extends 'numbers'
      ? number
      : never)

export interface TDateDef extends TDef, TDateState {
  readonly typeName: TTypeName.Date
  readonly checks: readonly TDateCheck[]
}

export class TDate<S extends TDateState = TDateState> extends TType<
  Date,
  TDateDef,
  TDateInput<S>
> {
  readonly hint = 'Date'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const { coerce, checks } = this._def

    if (coerce) {
      switch (coerce) {
        case 'strings':
          if (typeof ctx.data === 'string') {
            ctx.setData(utils.dayjs(ctx.data).toDate())
          }
          break
        case 'numbers':
          if (typeof ctx.data === 'number') {
            ctx.setData(new Date(ctx.data))
          }
          break
        default:
          if (typeof ctx.data === 'string' || typeof ctx.data === 'number') {
            ctx.setData(utils.dayjs(ctx.data).toDate())
          }
      }
    }

    if (!(ctx.data instanceof Date)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Date }).ABORT()
    }

    const currentDate = utils.dayjs(ctx.data)

    for (const check of checks) {
      switch (check.kind) {
        case 'min':
          if (
            check.inclusive
              ? currentDate.isBefore(parseDateDataInput(check.value))
              : currentDate.isSameOrBefore(parseDateDataInput(check.value))
          ) {
            ctx.DIRTY(IssueKind.InvalidDate, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'max':
          if (
            check.inclusive
              ? currentDate.isAfter(parseDateDataInput(check.value))
              : currentDate.isSameOrAfter(parseDateDataInput(check.value))
          ) {
            ctx.DIRTY(IssueKind.InvalidDate, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'range':
          if (
            currentDate.isBetween(
              parseDateDataInput(check.min),
              parseDateDataInput(check.max),
              undefined,
              `${['min', 'both'].includes(check.inclusive) ? '[' : '('}${
                ['max', 'both'].includes(check.inclusive) ? ']' : ')'
              }`
            )
          ) {
            ctx.DIRTY(IssueKind.InvalidDate, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
      }
    }

    return ctx.OK(ctx.data)
  }

  /**
   * Enables/disables coercion on the schema. Disabled by default.
   *
   * Possible values are:
   *
   * * `true` - Coerce both strings and numbers.
   * * `'strings'` - Coerce only strings.
   * * `'numbers'` - Coerce only numbers.
   * * `false` - Disable coercion (deal only with native `Date` objects).
   */
  coerce<T extends boolean | 'strings' | 'numbers' = true>(
    coercion = true as T
  ): TDate<{ coerce: T }> {
    return new TDate({ ...this._def, coerce: coercion })
  }

  /**
   * Specifies the oldest date allowed where:
   *
   * @param value - The oldest date allowed.
   * @param options - Options for this check.
   * @param options.inclusive - Whether the date is inclusive or not.
   * Defaults to `true`.
   * @param options.message - The error message to use.
   */
  min(
    value: DateDataInput,
    options?: { readonly inclusive?: boolean; readonly message?: string }
  ): TDate<S> {
    return this._addCheck('min', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeChecks(['range'])
  }

  /**
   * Shorthand for `min(value, { inclusive: false })`.
   *
   * @see {@link min | `min`}
   */
  after(
    value: DateDataInput,
    options?: { readonly message?: string }
  ): TDate<S> {
    return this.min(value, { inclusive: false, message: options?.message })
  }

  /**
   * Shorthand for `min(value, { inclusive: true })`.
   *
   * @see {@link min | `min`}
   */
  sameOrAfter(
    value: DateDataInput,
    options?: { readonly message?: string }
  ): TDate<S> {
    return this.min(value, { inclusive: true, message: options?.message })
  }

  /**
   * Specifies the latest date allowed where:
   *
   * @param value - The latest date allowed.
   * @param options - Options for this check.
   * @param options.inclusive - Whether the date is inclusive or not.
   * Defaults to `true`.
   * @param options.message - The error message to use.
   */
  max(
    value: DateDataInput,
    options?: { readonly inclusive?: boolean; readonly message?: string }
  ): TDate<S> {
    return this._addCheck('max', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeChecks(['range'])
  }

  /**
   * Shorthand for `max(value, { inclusive: false })`.
   *
   * @see {@link max | `max`}
   */
  before(
    value: DateDataInput,
    options?: { readonly message?: string }
  ): TDate<S> {
    return this.max(value, { inclusive: false, message: options?.message })
  }

  /**
   * Shorthand for `max(value, { inclusive: true })`.
   *
   * @see {@link max | `max`}
   */
  sameOrBefore(
    value: DateDataInput,
    options?: { readonly message?: string }
  ): TDate<S> {
    return this.max(value, { inclusive: true, message: options?.message })
  }

  /**
   * Specifies a range of dates where:
   *
   * @param min - The oldest date allowed.
   * @param max - The latest date allowed.
   * @param options - Options for this check.
   * @param options.inclusive - Whether the dates in the range are inclusive or not.
   * Defaults to `'both'`.
   * * `'min'` - Only the `min` value is inclusive in the range.
   * * `'max'` - Only the `max` value is inclusive in the range.
   * * `'both'` - Both the `min` and the `max` values are inclusive in the range.
   * * `'none'` - Neither the `min` or the `max` values are inclusive in the range.
   * @param options.message - The error message to use.
   */
  range(
    min: DateDataInput,
    max: DateDataInput,
    options?: {
      readonly inclusive?: 'min' | 'max' | 'both' | 'none'
      readonly message?: string
    }
  ): TDate<S> {
    return this._addCheck('range', {
      min,
      max,
      inclusive: options?.inclusive ?? 'both',
      message: options?.message,
    })._removeChecks(['min', 'max'])
  }

  /**
   * Alias for {@link range | `range`}.
   */
  between(
    min: DateDataInput,
    max: DateDataInput,
    options?: {
      readonly inclusive?: 'min' | 'max' | 'both' | 'none'
      readonly message?: string
    }
  ): TDate<S> {
    return this.range(min, max, options)
  }

  static create = (): TDate<{ coerce: false }> =>
    new TDate({ typeName: TTypeName.Date, checks: [], coerce: false })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                   Symbol                                   */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TSymbolDef extends TDef {
  readonly typeName: TTypeName.Symbol
}

export class TSymbol extends TType<symbol, TSymbolDef> {
  readonly hint = 'symbol'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return typeof ctx.data === 'symbol'
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.Symbol }).ABORT()
  }

  static create = (): TSymbol => new TSymbol({ typeName: TTypeName.Symbol })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                    Null                                    */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TNullDef extends TDef {
  readonly typeName: TTypeName.Null
}

export class TNull extends TType<null, TNullDef> {
  readonly hint = 'null'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === null
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.Null }).ABORT()
  }

  static create = (): TNull => new TNull({ typeName: TTypeName.Null })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                  Undefined                                 */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TUndefinedDef extends TDef {
  readonly typeName: TTypeName.Undefined
}

export class TUndefined extends TType<undefined, TUndefinedDef> {
  readonly hint = 'undefined'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === undefined
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.Undefined }).ABORT()
  }

  static create = (): TUndefined =>
    new TUndefined({ typeName: TTypeName.Undefined })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                    Void                                    */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TVoidDef extends TDef {
  readonly typeName: TTypeName.Void
}

export class TVoid extends TType<void, TVoidDef> {
  readonly hint = 'void'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === undefined
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.Void }).ABORT()
  }

  static create = (): TVoid => new TVoid({ typeName: TTypeName.Void })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                    Never                                   */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TNeverDef extends TDef {
  readonly typeName: TTypeName.Never
}

export class TNever extends TType<never, TNeverDef> {
  readonly hint = 'never'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.FORBIDDEN().ABORT()
  }

  static create = (): TNever => new TNever({ typeName: TTypeName.Never })
}

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                   Literal                                  */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TLiteralDef<V extends utils.Primitive> extends TDef {
  readonly typeName: TTypeName.Literal
  readonly value: V
}

export class TLiteral<V extends utils.Primitive> extends TType<
  V,
  TLiteralDef<V>
> {
  readonly hint = utils.literalize(this._def.value)

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!utils.isPrimitive(ctx.data)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Primitive }).ABORT()
    }

    if (ctx.data !== this.value) {
      return ctx
        .INVALID_LITERAL({ expected: this.value, received: ctx.data })
        .ABORT()
    }

    return ctx.OK(ctx.data as V)
  }

  get value(): V {
    return this._def.value
  }

  static create = <V extends utils.Primitive>(value: V): TLiteral<V> =>
    new TLiteral({ typeName: TTypeName.Literal, value })
}

export type AnyTLiteral = TLiteral<utils.Primitive>

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                 InstanceOf                                 */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TInstanceOfDef<T extends utils.Class> extends TDef {
  readonly typeName: TTypeName.InstanceOf
  readonly cls: T
}

export class TInstanceOf<T extends utils.Class> extends TType<
  InstanceType<T>,
  TInstanceOfDef<T>
> {
  readonly hint = `InstanceOf<${this.cls.name}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data instanceof this.cls
      ? ctx.OK(ctx.data)
      : ctx.INVALID_INSTANCE({ expected: this.cls.name }).ABORT()
  }

  get cls(): T {
    return this._def.cls
  }

  static create = <T extends utils.Class>(cls: T): TInstanceOf<T> =>
    new TInstanceOf({ typeName: TTypeName.InstanceOf, cls })
}

export type AnyTInstanceOf = TInstanceOf<utils.Class>

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                  Nullable                                  */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TNullableDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Nullable
  readonly underlying: T
}

export type UnwrapTNullableDeep<T> = T extends TNullable<infer U>
  ? UnwrapTNullableDeep<U>
  : T

export class TNullable<T extends AnyTType> extends TType<
  T['_O'] | null,
  TNullableDef<T>,
  T['_I'] | null
> {
  readonly hint = `${this.underlying.hint} | null`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === null
      ? ctx.OK(ctx.data)
      : this.underlying._parse(ctx.clone({ ttype: this.underlying }))
  }

  get underlying(): T {
    return this._def.underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): UnwrapTNullableDeep<T> {
    return this.underlying instanceof TNullable
      ? this.underlying.unwrapDeep()
      : this.underlying
  }

  static create = <T extends AnyTType>(underlying: T): TNullable<T> =>
    new TNullable({ typeName: TTypeName.Nullable, underlying })
}

export type AnyTNullable = TNullable<AnyTType>

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                  Optional                                  */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TOptionalDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Optional
  readonly underlying: T
}

export type UnwrapTOptionalDeep<T> = T extends TOptional<infer U>
  ? UnwrapTOptionalDeep<U>
  : T

export class TOptional<T extends AnyTType> extends TType<
  T['_O'] | undefined,
  TOptionalDef<T>,
  T['_I'] | undefined
> {
  readonly hint = `${this.underlying.hint} | undefined`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === undefined
      ? ctx.OK(ctx.data)
      : this.underlying._parse(ctx.clone({ ttype: this.underlying }))
  }

  get underlying(): T {
    return this._def.underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): UnwrapTOptionalDeep<T> {
    return this.underlying instanceof TOptional
      ? this.underlying.unwrapDeep()
      : this.underlying
  }

  static create = <T extends AnyTType>(underlying: T): TOptional<T> =>
    new TOptional({ typeName: TTypeName.Optional, underlying })
}

export type AnyTOptional = TOptional<AnyTType>

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                    Lazy                                    */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TLazyDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Lazy
  readonly getType: () => T
}

export type UnwrapTLazyDeep<T> = T extends TLazy<infer U>
  ? UnwrapTLazyDeep<U>
  : T

export class TLazy<T extends AnyTType> extends TType<
  T['_O'],
  TLazyDef<T>,
  T['_I']
> {
  get hint(): T['hint'] {
    return this.underlying.hint
  }

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return this.underlying._parse(ctx.clone({ ttype: this.underlying }))
  }

  get underlying(): T {
    return this._def.getType()
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): UnwrapTLazyDeep<T> {
    return this.underlying instanceof TLazy
      ? this.underlying.unwrapDeep()
      : this.underlying
  }

  static create = <T extends AnyTType>(factory: () => T): TLazy<T> =>
    new TLazy({ typeName: TTypeName.Lazy, getType: factory })
}

export type AnyTLazy = TLazy<AnyTType>

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                   Promise                                  */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TPromiseDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Promise
  readonly awaited: T
}

export type UnwrapTPromiseDeep<T> = T extends TPromise<infer U>
  ? UnwrapTPromiseDeep<U>
  : T

export class TPromise<T extends AnyTType> extends TType<
  Promise<T['_O']>,
  TPromiseDef<T>,
  Promise<T['_I']>
> {
  readonly hint = `Promise<${this.awaited.hint}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!(ctx.data instanceof Promise) && ctx.common.async === false) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Promise }).ABORT()
    }

    const promisified =
      ctx.data instanceof Promise ? ctx.data : Promise.resolve(ctx.data)

    return ctx.OK(promisified.then((data) => this.awaited.parseAsync(data)))
  }

  get awaited(): T {
    return this._def.awaited
  }

  get underlying(): T {
    return this.awaited
  }

  unwrap(): T {
    return this.awaited
  }

  unwrapDeep(): UnwrapTPromiseDeep<T> {
    return this.awaited instanceof TPromise
      ? this.awaited.unwrapDeep()
      : this.awaited
  }

  static create = <T extends AnyTType>(awaited: T): TPromise<T> =>
    new TPromise({ typeName: TTypeName.Promise, awaited })
}

export type AnyTPromise = TPromise<AnyTType>

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                   Branded                                  */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export const BRAND = Symbol('TBrand')
export type BRAND = typeof BRAND
export type Brand<B extends PropertyKey> = {
  readonly [BRAND]: { readonly [K in B]: true }
}

export interface TBrandedDef<T extends AnyTType, B extends PropertyKey>
  extends TDef {
  readonly typeName: TTypeName.Branded
  readonly type: T
  readonly brand: B
}

export class TBranded<T extends AnyTType, B extends PropertyKey> extends TType<
  T['_O'] & Brand<B>,
  TBrandedDef<T, B>,
  T['_I']
> {
  readonly hint: `Branded<${T['hint']}>` = `Branded<${this.underlying['hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return this.underlying._parse(
      ctx.clone({ ttype: this.underlying })
    ) as ParseResultOf<this>
  }

  get underlying(): T {
    return this._def.type
  }

  unwrap(): T {
    return this.underlying
  }

  removeBrand(): T {
    return this.underlying
  }

  getBrand(): B {
    return this._def.brand
  }

  static create = <T extends AnyTType, B extends PropertyKey>(
    type: T,
    brand: B
  ): TBranded<T, B> =>
    new TBranded({ typeName: TTypeName.Branded, type, brand })
}

export type AnyTBranded = TBranded<AnyTType, PropertyKey>

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                   Default                                  */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TDefaultDef<
  T extends AnyTType,
  D extends utils.Defined<T['_I']>
> extends TDef {
  readonly typeName: TTypeName.Default
  readonly type: T
  readonly getDefaultValue: () => D
}

export class TDefault<
  T extends AnyTType,
  D extends utils.Defined<T['_I']>
> extends TType<
  utils.Defined<T['_O']>,
  TDefaultDef<T, D>,
  T['_I'] | undefined
> {
  readonly hint: `Default<${T['hint']}>` = `Default<${this.underlying['hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (ctx.data === undefined) {
      ctx.setData(this.getDefault())
    }

    return this.underlying._parse(
      ctx.clone({ ttype: this.underlying })
    ) as ParseResultOf<this>
  }

  get underlying(): T {
    return this._def.type
  }

  unwrap(): T {
    return this.underlying
  }

  removeDefault(): T {
    return this.underlying
  }

  getDefault(): D {
    return this._def.getDefaultValue()
  }

  static create = <T extends AnyTType, D extends utils.Defined<T['_I']>>(
    type: T,
    defaultValue: D | (() => D)
  ): TDefault<T, D> =>
    new TDefault({
      typeName: TTypeName.Default,
      type,
      getDefaultValue: (typeof defaultValue === 'function'
        ? defaultValue
        : () => defaultValue) as () => D,
    })
}

export type AnyTDefault = TDefault<AnyTType, unknown>

/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/*                                    Catch                                   */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */

export interface TCatchDef<T extends AnyTType, C extends T['_I']> extends TDef {
  readonly typeName: TTypeName.Catch
  readonly type: T
  readonly getCatchValue: () => C
}

export class TCatch<T extends AnyTType, C extends T['_I']> extends TType<
  T['_O'] | C,
  TCatchDef<T, C>,
  T['_I']
> {
  readonly hint: `Catch<${T['hint']}>` = `Catch<${this.underlying['hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const result = this.underlying._parse(ctx.clone({ ttype: this.underlying }))

    if (result instanceof Promise) {
      return result.then((awaitedRes) =>
        ctx.OK(awaitedRes.ok ? awaitedRes.data : this.getCatch())
      )
    }

    return ctx.OK(result.ok ? result.data : this.getCatch())
  }

  get underlying(): T {
    return this._def.type
  }

  unwrap(): T {
    return this.underlying
  }

  removeCatch(): T {
    return this.underlying
  }

  getCatch(): C {
    return this._def.getCatchValue()
  }

  static create = <T extends AnyTType, C extends T['_I']>(
    type: T,
    catchValue: C | (() => C)
  ): TCatch<T, C> =>
    new TCatch({
      typeName: TTypeName.Catch,
      type,
      getCatchValue: (typeof catchValue === 'function'
        ? catchValue
        : () => catchValue) as () => C,
    })
}

export type AnyTCatch = TCatch<AnyTType, unknown>

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                       Object                                                       */
/* ------------------------------------------------------------------------------------------------------------------ */

export type TObjectShape = { [x: string]: AnyTType }
export type TObjectUnknownKeys = 'passthrough' | 'strip' | 'strict'
export type TObjectCatchall = AnyTType

export type TObjectIO<
  S extends TObjectShape,
  UK extends TObjectUnknownKeys | null,
  C extends TObjectCatchall | null,
  IO extends '_I' | '_O'
> = utils.Simplify<
  utils.EnforceOptional<{ [K in keyof S]: S[K][IO] }> &
    (C extends TObjectCatchall
      ? { [x: string]: C[IO] }
      : UK extends 'passthrough'
      ? { [x: string]: unknown }
      : UK extends 'strict'
      ? { [x: string]: never }
      : unknown)
>

export type TObjectPartialShape<
  S extends TObjectShape,
  K extends keyof S = keyof S
> = utils.Merge<
  S,
  { [k in K]: S[k] extends AnyTOptional ? S[k] : TOptional<S[k]> }
>

const makeShapePartial = <S extends TObjectShape, K extends keyof S = keyof S>(
  shape: S,
  keys?: readonly [K, ...K[]]
) =>
  Object.fromEntries(
    Object.entries(shape).map(([key, type]) => [
      key,
      !keys || (utils.includes(keys, key) && !(type instanceof TOptional))
        ? toptional(type)
        : type,
    ])
  ) as TObjectPartialShape<S, K>

export type PartialDeep<T extends AnyTType> = T extends TObject<
  infer S,
  infer UK,
  infer C
>
  ? TObject<{ [K in keyof S]: TOptional<PartialDeep<S[K]>> }, UK, C>
  : T extends TArray<infer El, infer St>
  ? TArray<PartialDeep<El>, St>
  : T extends TOptional<infer U>
  ? TOptional<PartialDeep<U>>
  : T extends TNullable<infer U>
  ? TNullable<PartialDeep<U>>
  : T

export const makePartialDeep = (type: AnyTType): any => {
  if (type instanceof TObject) {
    return type['_setShape'](
      Object.fromEntries(
        Object.entries(type.shape).map(([k, v]) => [
          k,
          TOptional.create(makePartialDeep(v as AnyTType)),
        ])
      )
    )
  } else if (type instanceof TArray) {
    return tarray(makePartialDeep(type.element))
  } else if (type instanceof TOptional) {
    return toptional(makePartialDeep(type.unwrap()))
  } else if (type instanceof TNullable) {
    return tnullable(makePartialDeep(type.unwrap()))
  } else {
    return type
  }
}

export type Deoptional<T extends AnyTType> = T extends TOptional<infer U>
  ? Deoptional<U>
  : T extends TNullable<infer U>
  ? TNullable<Deoptional<U>>
  : T

const deoptional = <T extends AnyTType>(type: T): Deoptional<T> =>
  type instanceof TOptional
    ? deoptional(type.unwrap())
    : type instanceof TNullable
    ? tnullable(deoptional(type.unwrap()))
    : type

export type TObjectRequiredShape<
  S extends TObjectShape,
  K extends keyof S = keyof S
> = utils.Merge<S, { [k in K]: Deoptional<S[k]> }>

const makeShapeRequired = <S extends TObjectShape, K extends keyof S = keyof S>(
  shape: S,
  keys?: readonly [K, ...K[]]
) =>
  Object.fromEntries(
    Object.entries(shape).map(([key, type]) => [
      key,
      !keys || utils.includes(keys, key) ? deoptional(type) : type,
    ])
  ) as TObjectRequiredShape<S, K>

export interface TObjectDef<
  S extends TObjectShape,
  UK extends TObjectUnknownKeys | null,
  C extends TObjectCatchall | null
> extends TDef {
  readonly typeName: TTypeName.Object
  readonly shape: S
  readonly unknownKeys: UK
  readonly catchall: C
}

export class TObject<
  S extends TObjectShape,
  UK extends TObjectUnknownKeys | null,
  C extends TObjectCatchall | null
> extends TType<
  TObjectIO<S, UK, C, '_O'>,
  TObjectDef<S, UK, C>,
  TObjectIO<S, UK, C, '_I'>
> {
  readonly hint = `{${Object.entries(this.shape)
    .map(([key, type]) => `${key}: ${type.hint}`)
    .join(', ')}}`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!utils.isObject(ctx.data)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Object }).ABORT()
    }

    const { shape, unknownKeys, catchall } = this._def
    const shapeKeys = Object.keys(shape)
    const extraKeys = new Set<string>()

    if (
      unknownKeys !== 'strip' ||
      catchall !== null ||
      !(catchall instanceof TNever)
    ) {
      // If we're not stripping unknown keys, nor we have a catchall, we
      // have to check for extra keys.
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.add(key)
        }
      }
    }

    // We validate each key in the shape.
    const resultPairs = new Map<ParseResult, ParseResult>()
    for (const key of shapeKeys) {
      const keyParser = shape[key]
      const value = ctx.data[key]
      resultPairs.set(
        { ok: true, data: key },
        keyParser._parse(
          ctx.child({ ttype: keyParser, data: value, path: [key] })
        )
      )
    }

    if (!catchall || catchall instanceof TNever) {
      if (unknownKeys === 'passthrough') {
        // If no catchall and unknown keys is `passthrough`,
        // we add the extra keys to the result.
        for (const key of extraKeys) {
          resultPairs.set(
            { ok: true, data: key },
            { ok: true, data: ctx.data[key] }
          )
        }
      } else if (unknownKeys === 'strict') {
        // If no catchall and unknown keys is `strict`,
        // we throw in case of extra keys.
        if (extraKeys.size > 0) {
          ctx.UNRECOGNIZED_KEYS({ keys: [...extraKeys] })
          if (ctx.common.abortEarly) {
            return ctx.ABORT()
          }
        }
      }
    } else {
      // If we have a catchall, we use it to validate the extra keys and add
      // them to the result.
      for (const key of extraKeys) {
        const value = ctx.data[key]
        resultPairs.set(
          { ok: true, data: key },
          catchall._parse(
            ctx.child({ ttype: catchall, data: value, path: [key] })
          )
        )
      }
    }

    if (ctx.common.async) {
      return Promise.resolve()
        .then(async () => {
          const syncPairs = new Map<SyncParseResult, SyncParseResult>()
          for (const [keyResult, valueResult] of resultPairs) {
            const keyResultSync = await keyResult
            const valueResultSync = await valueResult
            syncPairs.set(keyResultSync, valueResultSync)
          }
          return syncPairs
        })
        .then((syncPairs) => {
          const finalObject = {} as Record<string, unknown>
          for (const [key, value] of syncPairs) {
            if (key.ok && value.ok) {
              if (value.data !== undefined) {
                finalObject[key.data as string] = value.data
              }
            } else {
              return ctx.ABORT()
            }
          }
          return ctx.OK(finalObject as this['_O'])
        })
    } else {
      const finalObject = {} as Record<string, unknown>
      for (const [key, value] of resultPairs as Map<
        SyncParseResult,
        SyncParseResult
      >) {
        if (key.ok && value.ok) {
          if (value.data !== undefined) {
            finalObject[key.data as string] = value.data
          }
        } else {
          return ctx.ABORT()
        }
      }
      return ctx.OK(finalObject as this['_O'])
    }
  }

  get shape(): S {
    return this._def.shape
  }

  passthrough() {
    return this._setUnknownKeys('passthrough')
  }

  strip() {
    return this._setUnknownKeys('strip')
  }

  strict() {
    return this._setUnknownKeys('strict')
  }

  catchall<C_ extends TObjectCatchall>(catchall: C_) {
    return this._setCatchall(catchall)
  }

  augment<A extends TObjectShape>(augmentation: A) {
    return this._setShape(utils.merge(this.shape, augmentation))
  }

  extend<E extends TObjectShape>(extension: E) {
    return this.augment(extension)
  }

  merge<
    S_ extends TObjectShape,
    UK_ extends TObjectUnknownKeys | null,
    C_ extends TObjectCatchall | null
  >(incoming: TObject<S_, UK_, C_>) {
    return incoming._setShape(utils.merge(this.shape, incoming.shape))
  }

  setKey<K extends string, T extends AnyTType>(key: K, type: T) {
    return this.augment({ [key]: type } as { [k in K]: T })
  }

  pick<K extends keyof S>(
    ...keys: readonly [K, ...K[]]
  ): TObject<Pick<S, K>, UK, C>
  pick<K extends keyof S>(
    keys: readonly [K, ...K[]]
  ): TObject<Pick<S, K>, UK, C>
  pick<K extends keyof S>(...keys: readonly [K, ...K[]]) {
    return this._setShape(
      utils.pick(this.shape, Array.isArray(keys[0]) ? keys[0] : keys)
    )
  }

  omit<K extends keyof S>(
    ...keys: readonly [K, ...K[]]
  ): TObject<Omit<S, K>, UK, C>
  omit<K extends keyof S>(
    keys: readonly [K, ...K[]]
  ): TObject<Omit<S, K>, UK, C>
  omit<K extends keyof S>(...keys: readonly [K, ...K[]]) {
    return this._setShape(
      utils.omit(this.shape, Array.isArray(keys[0]) ? keys[0] : keys)
    )
  }

  partial<K extends keyof S = keyof S>(
    ...keys: readonly [K, ...K[]]
  ): TObject<TObjectPartialShape<S, K>, UK, C>
  partial<K extends keyof S = keyof S>(
    keys?: readonly [K, ...K[]]
  ): TObject<TObjectPartialShape<S, K>, UK, C>
  partial<K extends keyof S = keyof S>(...keys: readonly [K, ...K[]]) {
    return this._setShape(
      makeShapePartial(
        this.shape,
        (Array.isArray(keys[0]) ? keys[0] : keys) as readonly [K, ...K[]]
      )
    )
  }

  partialDeep() {
    return makePartialDeep(this)
  }

  required<K extends keyof S = keyof S>(
    ...keys: readonly [K, ...K[]]
  ): TObject<TObjectRequiredShape<S, K>, UK, C>
  required<K extends keyof S = keyof S>(
    keys?: readonly [K, ...K[]]
  ): TObject<TObjectRequiredShape<S, K>, UK, C>
  required<K extends keyof S = keyof S>(...keys: readonly [K, ...K[]]) {
    return this._setShape(
      makeShapeRequired(
        this.shape,
        (Array.isArray(keys[0]) ? keys[0] : keys) as readonly [K, ...K[]]
      )
    )
  }

  private _setUnknownKeys<UK_ extends TObjectUnknownKeys>(unknownKeys: UK_) {
    return new TObject({ ...this._def, unknownKeys, catchall: null })
  }

  private _setCatchall<C_ extends TObjectCatchall>(catchall: C_) {
    return new TObject({ ...this._def, catchall, unknownKeys: null })
  }

  private _setShape<S_ extends TObjectShape>(shape: S_) {
    return new TObject({ ...this._def, shape })
  }

  static create = Object.assign(
    <S extends TObjectShape>(shape: S) =>
      new TObject({
        typeName: TTypeName.Object,
        shape,
        unknownKeys: 'strip',
        catchall: null,
      }),
    {
      passthrough: <S extends TObjectShape>(shape: S) =>
        this.create(shape).passthrough(),
      strict: <S extends TObjectShape>(shape: S) => this.create(shape).strict(),
    }
  )
}

export type AnyTObject = TObject<
  TObjectShape,
  TObjectUnknownKeys | null,
  TObjectCatchall | null
>

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                       Record                                                       */
/* ------------------------------------------------------------------------------------------------------------------ */

export interface TRecordDef<
  K extends AnyTType<PropertyKey>,
  V extends AnyTType
> {
  readonly typeName: TTypeName.Record
  readonly keys: K
  readonly values: V
}

export class TRecord<
  K extends AnyTType<PropertyKey>,
  V extends AnyTType
> extends TType<
  { [k in K['_O']]: V['_O'] },
  TRecordDef<K, V>,
  { [k in K['_I']]: V['_I'] }
> {
  readonly hint: `Record<${K['hint']}, ${V['hint']}>` = `Record<${this.keys.hint}, ${this.values.hint}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {}

  get keys(): K {
    return this._def.keys
  }

  get values(): V {
    return this._def.values
  }

  static create<V extends AnyTType>(values: V): TRecord<TString, V>
  static create<K extends AnyTType<PropertyKey>, V extends AnyTType>(
    keys: K,
    values: V
  ): TRecord<K, V>
  static create(
    valuesOrKeys: AnyTType<PropertyKey>,
    maybeValues?: AnyTType
  ): TRecord<AnyTType<PropertyKey>, AnyTType> {
    if (maybeValues instanceof TType) {
      return new TRecord({
        typeName: TTypeName.Record,
        keys: valuesOrKeys,
        values: maybeValues,
      })
    }
    return new TRecord({
      typeName: TTypeName.Record,
      keys: TString.create(),
      values: valuesOrKeys,
    })
  }
}

export type AnyTRecord = TRecord<AnyTType<PropertyKey>, AnyTType>

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                       String                                                       */
/* ------------------------------------------------------------------------------------------------------------------ */

export interface TStringDef extends TDef {
  readonly typeName: TTypeName.String
}

export class TString extends TType<string, TStringDef> {
  readonly hint = 'string'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!(typeof ctx.data === 'string')) {
      return ctx.INVALID_TYPE({ expected: TParsedType.String }).ABORT()
    }

    return ctx.OK(ctx.data)
  }

  static create = (): TString => new TString({ typeName: TTypeName.String })
}

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                        Union                                                       */
/* ------------------------------------------------------------------------------------------------------------------ */

export type TUnionMembers = readonly [AnyTType, AnyTType, ...AnyTType[]]

const handleUnionResults =
  <T extends AnyTUnion>(ctx: ParseContextOf<T>) =>
  (results: readonly SyncParseResult[]): ParseResultOf<T> => {
    const successfulResults = results.filter((result) => !!result.ok)
    return successfulResults.length > 0
      ? ctx.OK(successfulResults[0].data)
      : ctx
          .INVALID_UNION({
            errors: results
              .map((result) => result.error)
              .filter((err): err is NonNullable<typeof err> => !!err),
          })
          .ABORT()
  }

export interface TUnionDef<T extends TUnionMembers> extends TDef {
  readonly typeName: TTypeName.Union
  readonly members: T
}

export class TUnion<T extends TUnionMembers> extends TType<
  T[number]['_O'],
  TUnionDef<T>,
  T[number]['_I']
> {
  readonly hint = this.members.map((m) => m.hint).join(' | ')

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (ctx.common.async) {
      return Promise.all(
        this.members.map(async (member) => member._parseAsync(ctx))
      ).then(handleUnionResults(ctx))
    } else {
      const results = this.members.map((member) => member._parseSync(ctx))
      return handleUnionResults(ctx)(results)
    }
  }

  get members(): T {
    return this._def.members
  }

  static create = <T extends TUnionMembers>(members: T): TUnion<T> =>
    new TUnion({ typeName: TTypeName.Union, members })
}

export type AnyTUnion = TUnion<TUnionMembers>

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                       Effects                                                      */
/* ------------------------------------------------------------------------------------------------------------------ */

export enum EffectKind {
  Refinement = 'refinement',
  Transform = 'transform',
  Preprocess = 'preprocess',
}

export interface EffectContext<O = unknown, I = O> {
  readonly issue: ParseContext<unknown, O, I>['DIRTY']
  readonly path: ParsePath
}

export interface BaseEffect<T extends EffectKind> {
  readonly kind: T
}

export interface RefinementEffect<Data = unknown>
  extends BaseEffect<EffectKind.Refinement> {
  refine(data: Data, ctx: EffectContext<Data>): boolean | Promise<boolean>
}

export interface TransformEffect<Data = unknown, O = unknown>
  extends BaseEffect<EffectKind.Transform> {
  transform(data: Data, ctx: EffectContext<Data>): O | Promise<O>
}

export interface PreprocessEffect<O = unknown>
  extends BaseEffect<EffectKind.Preprocess> {
  transform(data: unknown): O
}

export type TEffect<T = unknown, U = unknown> =
  | RefinementEffect<T>
  | TransformEffect<T, U>
  | PreprocessEffect<T>

export type RefinementMessageParameters = RequireAtLeastOne<
  Issue<IssueKind.Custom>['payload']
> & {
  readonly message: string
}

export type RefinementMsgArg<T> =
  | string
  | RefinementMessageParameters
  | ((data: T) => RefinementMessageParameters)

const createEffectContext = <O, I>(
  parseContext: ParseContext<unknown, O, I>
): EffectContext<O, I> => ({
  issue: (...arguments_) => parseContext['DIRTY'](...arguments_),
  path: [...parseContext.path],
})

type RefinementExecutorCreator<Async extends boolean = false> = <
  T,
  U extends EffectContext
>(
  effect: RefinementEffect<T>,
  effectContext: U
) => (data: T) => Async extends true ? Promise<boolean> : boolean

const createSyncRefinementExecutor: RefinementExecutorCreator =
  (effect, effectContext) => (data) => {
    const result = effect.refine(data, effectContext)
    if (result instanceof Promise) {
      throw new TypeError(
        'Async refinement encountered during synchronous parse operation. Use .parseAsync instead.'
      )
    }
    return result
  }

const createAsyncRefinementExecutor: RefinementExecutorCreator<true> =
  (effect, effectContext) => async (data) =>
    effect.refine(data, effectContext)

export interface TEffectsDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Effects
  readonly underlying: T
  readonly effect: TEffect
}

export type UnwrapTEffectsDeep<T> = T extends TEffects<
  infer U,
  infer O,
  infer I
>
  ? UnwrapTEffectsDeep<U> extends infer UU
    ? UU extends AnyTType
      ? TEffects<UU, O, I>
      : never
    : never
  : T

export class TEffects<
  T extends AnyTType<any>,
  O = T['_O'],
  I = T['_I']
> extends TType<O, TEffectsDef<T>, I> {
  readonly hint: string = this.source.hint

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const { underlying, effect } = this._def

    if (effect.kind === EffectKind.Preprocess) {
      const processed = effect.transform(ctx.data)

      return ctx.common.async
        ? Promise.resolve(processed).then((processedAsync) => {
            ctx.setData(processedAsync as O)
            return underlying._parseAsync(ctx)
          })
        : ctx.setData(processed as O) && underlying._parseSync(ctx)
    }

    const effectContext = createEffectContext(ctx)

    if (effect.kind === EffectKind.Refinement) {
      if (ctx.common.async) {
        const executeRefinement = createAsyncRefinementExecutor(
          effect,
          effectContext
        )
        return underlying
          ._parseAsync(ctx)
          .then((underlyingResult) =>
            underlyingResult.ok
              ? executeRefinement(underlyingResult.data).then(
                  (refinementResult) =>
                    refinementResult
                      ? ctx.OK(underlyingResult.data)
                      : ctx.ABORT()
                )
              : ctx.ABORT()
          )
      } else {
        const executeRefinement = createSyncRefinementExecutor(
          effect,
          effectContext
        )
        const underlyingResult = underlying._parseSync(ctx)
        return underlyingResult.ok && executeRefinement(underlyingResult.data)
          ? ctx.OK(underlyingResult.data)
          : ctx.ABORT()
      }
    }

    if (effect.kind === EffectKind.Transform) {
      if (ctx.common.async) {
        return underlying._parseAsync(ctx).then((base) => {
          if (!base.ok) {
            return ctx.ABORT()
          }
          return Promise.resolve(
            effect.transform(base.data, effectContext)
          ).then((result) =>
            ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result as T['_O'])
          )
        })
      } else {
        const base = underlying._parseSync(ctx)
        if (!base.ok) {
          return ctx.ABORT()
        }
        const result = effect.transform(base.data, effectContext)
        if (result instanceof Promise) {
          throw new TypeError(
            'Asynchronous transform encountered during synchronous parse operation. Use `.parseAsync()` instead.'
          )
        }
        return ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result as T['_O'])
      }
    }

    return ctx.ABORT()
  }

  get underlying(): T {
    return this._def.underlying
  }

  get source(): UnwrapTEffectsDeep<T> {
    const { underlying } = this
    return underlying instanceof TEffects ? underlying.unwrapDeep() : underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): UnwrapTEffectsDeep<T> {
    return this.source
  }

  private static _create<
    S extends AnyTType,
    O = S['_O'],
    I = S['_I'],
    E extends TEffect = TEffect
  >(type: S, effect: E) {
    return new TEffects<S, O, I>({
      typeName: TTypeName.Effects,
      underlying: type,
      effect,
    })
  }

  static refine<T extends AnyTType, RefinedOutput extends T['_O']>(
    schema: T,
    check: (data: T['_O']) => data is RefinedOutput,
    message?: RefinementMsgArg<T['_O']>
  ): TEffects<T, RefinedOutput, T['_I']>
  static refine<T extends AnyTType, U>(
    schema: T,
    check: (data: T['_O']) => U | Promise<U>,
    message?: RefinementMsgArg<T['_O']>
  ): TEffects<T, T['_O'], T['_I']>
  static refine<T extends AnyTType>(
    schema: T,
    check: (data: T['_O']) => unknown | Promise<unknown>,
    message?: RefinementMsgArg<T['_O']>
  ): TEffects<T, T['_O'], T['_I']> {
    const getIssuePayload = (
      data: T['_O']
    ): Issue<IssueKind.Custom>['payload'] => {
      if (!message || typeof message === 'string') {
        return { message }
      } else if (typeof message === 'function') {
        return message(data)
      } else {
        return message
      }
    }
    return TEffects._create(schema, {
      kind: EffectKind.Refinement,
      refine: (data, ctx) => {
        const result = check(data)
        console.log(result)
        const abort = () => {
          const issuePayload = getIssuePayload(data)
          ctx.issue(IssueKind.Custom, issuePayload, issuePayload.message)
          return false
        }
        if (result instanceof Promise) {
          return result.then((resolvedResult) => !!resolvedResult || abort())
        }
        return !!result || abort()
      },
    })
  }

  static transform<T extends AnyTType, NewOut>(
    type: T,
    transform: (
      data: T['_O'],
      ctx: EffectContext<T['_O']>
    ) => NewOut | Promise<NewOut>
  ): TEffects<T, NewOut, T['_I']> {
    return TEffects._create<
      T,
      NewOut,
      T['_I'],
      TransformEffect<T['_O'], NewOut>
    >(type, {
      kind: EffectKind.Transform,
      transform,
    })
  }

  static preprocess<O, T extends TType<O, any, any>>(
    preprocess: (data: unknown) => O,
    type: T
  ): TEffects<T, O, T['_I']> {
    return TEffects._create<T, O, T['_I'], PreprocessEffect<O>>(type, {
      kind: EffectKind.Preprocess,
      transform: preprocess,
    })
  }
}

export type AnyTEffects = TEffects<AnyTType, any, any>

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                       Extras                                                       */
/* ------------------------------------------------------------------------------------------------------------------ */

const TNullish = {
  create: <T extends AnyTType>(underlying: T) =>
    TOptional.create(TNullable.create(underlying)),
}

/* ------------------------------------------------------------------------------------------------------------------ */

export enum TTypeName {
  Any = 'TAny',
  Array = 'TArray',
  BigInt = 'TBigInt',
  Boolean = 'TBoolean',
  Branded = 'TBrand',
  Catch = 'TCatch',
  Date = 'TDate',
  Default = 'TDefault',
  DiscriminatedUnion = 'TDiscriminatedUnion',
  Effects = 'TEffects',
  Enum = 'TEnum',
  False = 'TFalse',
  Function = 'TFunction',
  InstanceOf = 'TInstanceOf',
  Intersection = 'TIntersection',
  Lazy = 'TLazy',
  Literal = 'TLiteral',
  Map = 'TMap',
  NaN = 'TNaN',
  Never = 'TNever',
  Null = 'TNull',
  Nullable = 'TNullable',
  Number = 'TNumber',
  Object = 'TObject',
  Optional = 'TOptional',
  Promise = 'TPromise',
  Record = 'TRecord',
  Set = 'TSet',
  String = 'TString',
  Symbol = 'TSymbol',
  True = 'TTrue',
  Tuple = 'TTuple',
  Undefined = 'TUndefined',
  Union = 'TUnion',
  Unknown = 'TUnknown',
  Void = 'TVoid',
}

export type TTypeNameMap = {
  [TTypeName.Any]: TAny
  [TTypeName.Array]: AnyTArray
  [TTypeName.BigInt]: TBigInt
  [TTypeName.Boolean]: TBoolean
  [TTypeName.Branded]: AnyTBranded
  [TTypeName.Catch]: AnyTCatch
  [TTypeName.Date]: TDate
  [TTypeName.Default]: AnyTDefault
  [TTypeName.DiscriminatedUnion]: TAny
  [TTypeName.Effects]: AnyTEffects
  [TTypeName.Enum]: AnyTEnum
  [TTypeName.False]: TFalse
  [TTypeName.Function]: TAny
  [TTypeName.InstanceOf]: AnyTInstanceOf
  [TTypeName.Intersection]: TAny
  [TTypeName.Lazy]: AnyTLazy
  [TTypeName.Literal]: AnyTLiteral
  [TTypeName.Map]: TAny
  [TTypeName.NaN]: TNaN
  [TTypeName.Never]: TNever
  [TTypeName.Null]: TNull
  [TTypeName.Nullable]: AnyTNullable
  [TTypeName.Number]: TAny
  [TTypeName.Object]: AnyTObject
  [TTypeName.Optional]: AnyTOptional
  [TTypeName.Promise]: AnyTPromise
  [TTypeName.Record]: AnyTRecord
  [TTypeName.Set]: TAny
  [TTypeName.String]: TString
  [TTypeName.Symbol]: TSymbol
  [TTypeName.True]: TTrue
  [TTypeName.Tuple]: TAny
  [TTypeName.Undefined]: TUndefined
  [TTypeName.Union]: AnyTUnion
  [TTypeName.Unknown]: TUnknown
  [TTypeName.Void]: TVoid
}

/* ------------------------------------------------------------------------------------------------------------------ */

const tany = TAny.create
const tarray = TArray.create
const tbigint = TBigInt.create
const tbool = TBoolean.create
const tboolean = TBoolean.create
const tbranded = TBranded.create
const tcatch = TCatch.create
const tdate = TDate.create
const tdefault = TDefault.create
const tenum = TEnum.create
const tfalse = TFalse.create
const tinstanceof = TInstanceOf.create
const tlazy = TLazy.create
const tliteral = TLiteral.create
const tnan = TNaN.create
const tnever = TNever.create
const tnull = TNull.create
const tnullable = TNullable.create
const tnullish = TNullish.create
const tobject = TObject.create
const toptional = TOptional.create
const tpreprocess = TEffects.preprocess
const tpromise = TPromise.create
const trefine = TEffects.refine
const tsymbol = TSymbol.create
const ttransform = TEffects.transform
const ttrue = TTrue.create
const tundefined = TUndefined.create
const tunion = TUnion.create
const tunknown = TUnknown.create
const tvoid = TVoid.create

export {
  tany as any,
  tarray as array,
  tbigint as bigint,
  tbool as bool,
  tboolean as boolean,
  tbranded as branded,
  tcatch as catch,
  tdate as date,
  tdefault as default,
  tenum as enum,
  tfalse as false,
  tinstanceof as instanceof,
  tlazy as lazy,
  tliteral as literal,
  tnan as nan,
  tnever as never,
  tnull as null,
  tnullable as nullable,
  tnullish as nullish,
  tobject as object,
  toptional as optional,
  tpreprocess as preprocess,
  tpromise as promise,
  trefine as refine,
  tsymbol as symbol,
  ttransform as transform,
  ttrue as true,
  tundefined as undefined,
  tunion as union,
  tunknown as unknown,
  tvoid as void,
}

export type output<T extends AnyTType> = T['_O']
export type input<T extends AnyTType> = T['_I']
export type infer<T extends AnyTType> = T['_O']
