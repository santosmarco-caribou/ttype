import type { Dayjs } from 'dayjs'
import { nanoid } from 'nanoid'
import type { N } from 'ts-toolbelt'
import type { RequireAtLeastOne } from 'type-fest'
import type { ErrorMap } from './error'
import { TGlobal } from './global'
import { IssueKind, type Issue, type checks } from './issues'
import {
  ParseContext,
  TParsedType,
  getParsedType,
  type AsyncParseResultOf,
  type ParseContextOf,
  type ParseOptions,
  type ParsePath,
  type ParseResult,
  type ParseResultOf,
  type SuccessfulParseResult,
  type SyncParseResult,
  type SyncParseResultOf,
} from './parse'
import { utils } from './utils'

export interface CreateOptions {
  readonly errorMap?: ErrorMap
}

export interface TOptions extends CreateOptions {
  readonly abortEarly?: boolean
}

export interface TDef {
  readonly typeName: TTypeName
  readonly options: TOptions | undefined
  readonly checks?: readonly { readonly kind: string }[]
}

export abstract class TType<O, Def extends TDef, I = O> {
  readonly _O!: O
  readonly _I!: I

  protected readonly _def: utils.Merge<Def, { readonly options: TOptions }>

  readonly id: string = nanoid()

  get typeName(): Def['typeName'] {
    return this._def.typeName
  }

  get options(): TOptions {
    return this._def.options
  }

  protected constructor(def: Def) {
    this._def = { ...def, options: { ...def.options } }

    this._parse = utils.memoize(this._parse.bind(this))
    this._parseSync = utils.memoize(this._parseSync.bind(this))
    this._parseAsync = utils.memoize(this._parseAsync.bind(this))
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
    this.and = this.and.bind(this)
    this.array = this.array.bind(this)
    this.promise = this.promise.bind(this)
    this.brand = this.brand.bind(this)
    this.default = this.default.bind(this)
    this.catch = this.catch.bind(this)
    this.lazy = this.lazy.bind(this)
    this.refine = this.refine.bind(this)
    this.transform = this.transform.bind(this)
    this.preprocess = this.preprocess.bind(this)
    this.pipe = this.pipe.bind(this)
    this.isOptional = this.isOptional.bind(this)
    this.isNullable = this.isNullable.bind(this)
    this.isType = this.isType.bind(this)

    Object.getOwnPropertyNames(this)
      .filter((prop) => prop.match(/^\$?_/))
      .forEach((prop) =>
        Object.defineProperty(this, prop, { enumerable: false })
      )
  }

  abstract _parse(ctx: ParseContext<unknown, O, I>): ParseResultOf<this>

  abstract readonly hint: string

  _parseSync(ctx: ParseContext<unknown, O, I>): SyncParseResultOf<this> {
    const result = this._parse(ctx)
    if (result instanceof Promise) {
      throw new Error('Synchronous parse encountered promise')
    }
    return result
  }

  async _parseAsync(
    ctx: ParseContext<unknown, O, I>
  ): AsyncParseResultOf<this> {
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
    return TOptional.create(this, this.options)
  }

  nullable(): TNullable<this> {
    return TNullable.create(this, this.options)
  }

  nullish(): TOptional<TNullable<this>> {
    return this.nullable().optional()
  }

  or<T extends [AnyTType, ...AnyTType[]]>(
    ...types: T
  ): TUnion<[this, T[0], ...utils.Tail<T>]> {
    return TUnion.create([this, types[0], ...utils.tail(types)], this.options)
  }

  and<T extends [AnyTType, ...AnyTType[]]>(
    ...types: T
  ): TIntersection<[this, T[0], ...utils.Tail<T>]> {
    return TIntersection.create(
      [this, types[0], ...utils.tail(types)],
      this.options
    )
  }

  array(): TArray<this> {
    return TArray.create(this, this.options)
  }

  promise(): TPromise<this> {
    return TPromise.create(this, this.options)
  }

  brand<B extends PropertyKey>(brand: B): TBranded<this, B> {
    return TBranded.create(this, brand, this.options)
  }

  default<D extends utils.Defined<I>>(
    defaultValue: D | (() => D)
  ): TDefault<this, D> {
    return TDefault.create(this, defaultValue, this.options)
  }

  catch<C extends I>(catchValue: C | (() => C)): TCatch<this, C> {
    return TCatch.create(this, catchValue, this.options)
  }

  lazy(): TLazy<this> {
    return TLazy.create(() => this, this.options)
  }

  refine<O_ extends O>(
    check: (data: O) => data is O_,
    message?: RefinementMsgArg<O>
  ): TEffects<this, O_>
  refine<T>(
    check: (data: O) => T | Promise<T>,
    message?: RefinementMsgArg<O>
  ): TEffects<this>
  refine(
    check: (data: O) => unknown,
    message?: RefinementMsgArg<O>
  ): TEffects<this> {
    return TEffects.refine(this, check, message, this.options)
  }

  transform<O_>(
    transform: (data: O, ctx: EffectContext<O>) => O_ | Promise<O_>
  ): TEffects<this, O_> {
    return TEffects.transform(this, transform, this.options)
  }

  preprocess(preprocess: (data: unknown) => I): TEffects<this> {
    return TEffects.preprocess(preprocess, this, this.options)
  }

  pipe<O_, T extends AnyTType<O_, I>>(type: T): TPipeline<this, T> {
    return TPipeline.create(this, type)
  }

  isOptional(): boolean {
    return this.safeParse(undefined).ok
  }

  isNullable(): boolean {
    return this.safeParse(null).ok
  }

  isType<T extends TTypeName>(
    ...types: readonly [T, ...T[]]
  ): this is TTypeNameMap[T] {
    return utils.includes(types, this.typeName)
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
      utils.mergeDeep(utils.cloneDeep(this._def), def),
    ])
  }
}

export type AnyTType<O = unknown, I = O> = TType<O, TDef, I>

/* -------------------------------------------------------------------------- */
/*                                     Any                                    */
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

  static create = (options?: CreateOptions): TAny =>
    new TAny({ typeName: TTypeName.Any, options })
}

/* -------------------------------------------------------------------------- */
/*                                   Unknown                                  */
/* -------------------------------------------------------------------------- */

export interface TUnknownDef extends TDef {
  readonly typeName: TTypeName.Unknown
}

export class TUnknown extends TType<unknown, TUnknownDef> {
  readonly hint = 'unknown'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.OK(ctx.data)
  }

  static create = (options?: CreateOptions): TUnknown =>
    new TUnknown({ typeName: TTypeName.Unknown, options })
}

/* -------------------------------------------------------------------------- */
/*                                   String                                   */
/* -------------------------------------------------------------------------- */

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

  static create = (options?: CreateOptions): TString =>
    new TString({ typeName: TTypeName.String, options })
}

/* -------------------------------------------------------------------------- */
/*                                   Number                                   */
/* -------------------------------------------------------------------------- */

export interface TNumberDef extends TDef {
  readonly typeName: TTypeName.Number
}

export class TNumber extends TType<number, TNumberDef> {
  readonly hint = 'number'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!(typeof ctx.data === 'number')) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Number }).ABORT()
    }

    return ctx.OK(ctx.data)
  }

  static create = (options?: CreateOptions): TNumber =>
    new TNumber({ typeName: TTypeName.Number, options })
}

/* -------------------------------------------------------------------------- */
/*                                   BigInt                                   */
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

  static create = (options?: CreateOptions): TBigInt =>
    new TBigInt({ typeName: TTypeName.BigInt, options })
}

/* -------------------------------------------------------------------------- */
/*                                     NaN                                    */
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

  static create = (options?: CreateOptions): TNaN =>
    new TNaN({ typeName: TTypeName.NaN, options })
}

/* -------------------------------------------------------------------------- */
/*                                   Boolean                                  */
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

  static create = (options?: CreateOptions): TBoolean<{ coerce: false }> =>
    new TBoolean({ typeName: TTypeName.Boolean, options, coerce: false })
}

/* -------------------------------------------------------------------------- */
/*                                    True                                    */
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

  static create = (options?: CreateOptions): TTrue =>
    new TTrue({ typeName: TTypeName.True, options })
}

/* -------------------------------------------------------------------------- */
/*                                    False                                   */
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

  static create = (options?: CreateOptions): TFalse =>
    new TFalse({ typeName: TTypeName.False, options })
}

/* -------------------------------------------------------------------------- */
/*                                    Date                                    */
/* -------------------------------------------------------------------------- */

export type TDateCheckInputRaw =
  | utils.LiteralUnion<'now', string>
  | number
  | Date
  | Dayjs
export type TDateCheckInput = Date | 'now'

export type TDateCheck =
  | checks.Min<TDateCheckInput>
  | checks.Max<TDateCheckInput>
  | checks.Range<TDateCheckInput>

const parseTDateCheckInput = (data: TDateCheckInputRaw): TDateCheckInput =>
  data === 'now' ? 'now' : utils.dayjs(data).toDate()
const toDayjsInput = (data: TDateCheckInput): Dayjs =>
  data === 'now' ? utils.dayjs() : utils.dayjs(data)

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

    const data = utils.dayjs(ctx.data)

    for (const check of checks) {
      switch (check.kind) {
        case 'min':
          if (
            check.inclusive
              ? data.isBefore(toDayjsInput(check.value))
              : data.isSameOrBefore(toDayjsInput(check.value))
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
              ? data.isAfter(toDayjsInput(check.value))
              : data.isSameOrAfter(toDayjsInput(check.value))
          ) {
            ctx.DIRTY(IssueKind.InvalidDate, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'range':
          if (
            data.isBetween(
              check.min,
              check.max,
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
    value: TDateCheckInputRaw,
    options?: { readonly inclusive?: boolean; readonly message?: string }
  ): TDate<S> {
    return this._addCheck('min', {
      value: parseTDateCheckInput(value),
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
    value: TDateCheckInputRaw,
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
    value: TDateCheckInputRaw,
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
    value: TDateCheckInputRaw,
    options?: { readonly inclusive?: boolean; readonly message?: string }
  ): TDate<S> {
    return this._addCheck('max', {
      value: parseTDateCheckInput(value),
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
    value: TDateCheckInputRaw,
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
    value: TDateCheckInputRaw,
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
    min: TDateCheckInputRaw,
    max: TDateCheckInputRaw,
    options?: {
      readonly inclusive?: 'min' | 'max' | 'both' | 'none'
      readonly message?: string
    }
  ): TDate<S> {
    return this._addCheck('range', {
      min: parseTDateCheckInput(min),
      max: parseTDateCheckInput(max),
      inclusive: options?.inclusive ?? 'both',
      message: options?.message,
    })._removeChecks(['min', 'max'])
  }

  /**
   * Alias for {@link range | `range`}.
   */
  between(
    min: TDateCheckInputRaw,
    max: TDateCheckInputRaw,
    options?: {
      readonly inclusive?: 'min' | 'max' | 'both' | 'none'
      readonly message?: string
    }
  ): TDate<S> {
    return this.range(min, max, options)
  }

  static create = (options?: CreateOptions): TDate<{ coerce: false }> =>
    new TDate({ typeName: TTypeName.Date, options, checks: [], coerce: false })
}

/* -------------------------------------------------------------------------- */
/*                                   Symbol                                   */
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

  static create = (options?: CreateOptions): TSymbol =>
    new TSymbol({ typeName: TTypeName.Symbol, options })
}

/* -------------------------------------------------------------------------- */
/*                                    Null                                    */
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

  static create = (options?: CreateOptions): TNull =>
    new TNull({ typeName: TTypeName.Null, options })
}

/* -------------------------------------------------------------------------- */
/*                                  Undefined                                 */
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

  static create = (options?: CreateOptions): TUndefined =>
    new TUndefined({ typeName: TTypeName.Undefined, options })
}

/* -------------------------------------------------------------------------- */
/*                                    Void                                    */
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

  static create = (options?: CreateOptions): TVoid =>
    new TVoid({ typeName: TTypeName.Void, options })
}

/* -------------------------------------------------------------------------- */
/*                                    Never                                   */
/* -------------------------------------------------------------------------- */

export interface TNeverDef extends TDef {
  readonly typeName: TTypeName.Never
}

export class TNever extends TType<never, TNeverDef> {
  readonly hint = 'never'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.FORBIDDEN().ABORT()
  }

  static create = (options?: CreateOptions): TNever =>
    new TNever({ typeName: TTypeName.Never, options })
}

/* -------------------------------------------------------------------------- */
/*                                   Literal                                  */
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

  static create = <V extends utils.Primitive>(
    value: V,
    options?: CreateOptions
  ): TLiteral<V> =>
    new TLiteral({ typeName: TTypeName.Literal, options, value })
}

export type AnyTLiteral = TLiteral<utils.Primitive>

/* -------------------------------------------------------------------------- */
/*                                    Enum                                    */
/* -------------------------------------------------------------------------- */

export type EnumValue = string | number
export type EnumValues<T extends EnumValue = EnumValue> = readonly [T, ...T[]]

export type EnumLike = { [x: string]: EnumValue } & { [x: number]: string }

export type UnionToEnumValues<T> =
  utils.UnionToTuple<T> extends infer X extends EnumValues ? X : never

export type ToEnumPrimitive<T extends EnumValue> =
  `${T}` extends `${infer N extends number}` ? N : `${T}`

export type ToEnumLike<T> = utils.Simplify<
  utils.OmitIndexSignature<T>
> extends infer X
  ? X extends EnumLike
    ? { [K in keyof X]: ToEnumPrimitive<X[K]> }
    : never
  : never

export type EnumExtract<T extends EnumLike, V extends T[keyof T]> = ToEnumLike<{
  [K in keyof T as ToEnumPrimitive<T[K]> extends ToEnumPrimitive<V>
    ? K
    : never]: T[K]
}>
export type EnumExclude<T extends EnumLike, V extends T[keyof T]> = ToEnumLike<{
  [K in keyof T as ToEnumPrimitive<T[K]> extends ToEnumPrimitive<V>
    ? never
    : K]: T[K]
}>

export interface TEnumDef<T extends EnumLike> extends TDef {
  readonly typeName: TTypeName.Enum
  readonly enum: T
}

export class TEnum<T extends EnumLike> extends TType<T[keyof T], TEnumDef<T>> {
  readonly hint = this.values.map(utils.literalize).join(' | ')

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const enumTypes = [
      ...new Set(
        this.values
          .map((value) => typeof value)
          .filter((type): type is 'string' | 'number' =>
            utils.includes(['string', 'number'], type)
          )
      ),
    ]

    const isValidEnumType = (data: unknown): data is EnumValue =>
      utils.includes(enumTypes, typeof data)

    if (!isValidEnumType(ctx.data)) {
      return ctx
        .INVALID_TYPE({
          expected:
            enumTypes.length === 1
              ? { string: TParsedType.String, number: TParsedType.Number }[
                  enumTypes[0]
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

    return ctx.OK(ctx.data as T[keyof T])
  }

  get enum(): T {
    return this._def.enum
  }

  get values(): UnionToEnumValues<T[keyof T]> {
    return Object.values(this.enum) as unknown as UnionToEnumValues<T[keyof T]>
  }

  extract<V extends T[keyof T]>(
    ...values: readonly [V, ...V[]]
  ): TEnum<EnumExtract<T, V>>
  extract<V extends T[keyof T]>(
    values: readonly [V, ...V[]]
  ): TEnum<EnumExtract<T, V>>
  extract<V extends T[keyof T]>(...values: readonly [V, ...V[]]) {
    const valuesArr = Array.isArray(values[0]) ? values[0] : values
    return new TEnum({
      ...this._def,
      typeName: TTypeName.Enum,
      enum: Object.fromEntries(
        Object.entries(this.enum).filter(([_, v]) =>
          utils.includes(valuesArr, v)
        )
      ) as EnumExtract<T, V>,
    })
  }

  exclude<V extends T[keyof T]>(
    ...values: readonly [V, ...V[]]
  ): TEnum<EnumExclude<T, V>>
  exclude<V extends T[keyof T]>(
    values: readonly [V, ...V[]]
  ): TEnum<EnumExclude<T, V>>
  exclude<V extends T[keyof T]>(...values: readonly [V, ...V[]]) {
    const valuesArr = Array.isArray(values[0]) ? values[0] : values
    return new TEnum({
      ...this._def,
      typeName: TTypeName.Enum,
      enum: Object.fromEntries(
        Object.entries(this.enum).filter(
          ([_, v]) => !utils.includes(valuesArr, v)
        )
      ) as EnumExclude<T, V>,
    })
  }

  private static _create<V extends EnumValue, T extends EnumValues<V>>(
    values: T,
    options?: CreateOptions
  ): TEnum<{ readonly [K in T[number]]: K }>
  private static _create<T extends EnumLike>(
    enum_: T,
    options?: CreateOptions
  ): TEnum<ToEnumLike<{ readonly [K in keyof T]: T[K] }>>
  private static _create(
    valuesOrEnum: EnumValues | EnumLike,
    options?: CreateOptions
  ) {
    const getValidEnumObject = <T extends EnumLike>(
      obj: T
    ): { [x: string]: EnumValue } =>
      Object.fromEntries(
        Object.entries(obj)
          .filter(([k]) => typeof obj[obj[k]] !== 'number')
          .map(([k]) => [k, obj[k]])
      )

    return new TEnum({
      typeName: TTypeName.Enum,
      options,
      enum: Array.isArray(valuesOrEnum)
        ? Object.fromEntries(valuesOrEnum.map((val) => [val, val]))
        : getValidEnumObject(valuesOrEnum as EnumLike),
    })
  }

  static create = this._create
}

export type AnyTEnum = TEnum<EnumLike>

/* -------------------------------------------------------------------------- */
/*                                 InstanceOf                                 */
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

  static create = <T extends utils.Class>(
    cls: T,
    options?: CreateOptions
  ): TInstanceOf<T> =>
    new TInstanceOf({ typeName: TTypeName.InstanceOf, options, cls })
}

export type AnyTInstanceOf = TInstanceOf<utils.Class>

/* -------------------------------------------------------------------------- */
/*                                  Nullable                                  */
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
  readonly hint: `${T['hint']} | null` = `${this.underlying.hint} | null`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === null
      ? ctx.OK(ctx.data)
      : this.underlying._parse(ctx.clone({ type: this.underlying }))
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

  static create = <T extends AnyTType>(
    underlying: T,
    options?: CreateOptions
  ): TNullable<T> =>
    new TNullable({ typeName: TTypeName.Nullable, options, underlying })
}

export type AnyTNullable = TNullable<AnyTType>

/* -------------------------------------------------------------------------- */
/*                                  Optional                                  */
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
  readonly hint: `${T['hint']} | undefined` = `${this.underlying.hint} | undefined`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === undefined
      ? ctx.OK(ctx.data)
      : this.underlying._parse(ctx.clone({ type: this.underlying }))
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

  static create = <T extends AnyTType>(
    underlying: T,
    options?: CreateOptions
  ): TOptional<T> =>
    new TOptional({ typeName: TTypeName.Optional, options, underlying })
}

export type AnyTOptional = TOptional<AnyTType>

/* -------------------------------------------------------------------------- */
/*                                    Lazy                                    */
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
    return this.underlying._parse(ctx.clone({ type: this.underlying }))
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

  static create = <T extends AnyTType>(
    factory: () => T,
    options?: CreateOptions
  ): TLazy<T> =>
    new TLazy({ typeName: TTypeName.Lazy, options, getType: factory })
}

export type AnyTLazy = TLazy<AnyTType>

/* -------------------------------------------------------------------------- */
/*                                   Promise                                  */
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
  readonly hint: `Promise<${T['hint']}>` = `Promise<${this.awaited.hint}>`

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

  static create = <T extends AnyTType>(
    awaited: T,
    options?: CreateOptions
  ): TPromise<T> =>
    new TPromise({ typeName: TTypeName.Promise, options, awaited })
}

export type AnyTPromise = TPromise<AnyTType>

/* -------------------------------------------------------------------------- */
/*                                   Branded                                  */
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
      ctx.clone({ type: this.underlying })
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
    brand: B,
    options?: CreateOptions
  ): TBranded<T, B> =>
    new TBranded({ typeName: TTypeName.Branded, options, type, brand })
}

export type AnyTBranded = TBranded<AnyTType, PropertyKey>

/* -------------------------------------------------------------------------- */
/*                                   Default                                  */
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
      ctx.clone({ type: this.underlying })
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
    defaultValue: D | (() => D),
    options?: CreateOptions
  ): TDefault<T, D> =>
    new TDefault({
      typeName: TTypeName.Default,
      options,
      type,
      getDefaultValue: (typeof defaultValue === 'function'
        ? defaultValue
        : () => defaultValue) as () => D,
    })
}

export type AnyTDefault = TDefault<AnyTType, unknown>

/* -------------------------------------------------------------------------- */
/*                                    Catch                                   */
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
    const result = this.underlying._parse(ctx.clone({ type: this.underlying }))

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
    catchValue: C | (() => C),
    options?: CreateOptions
  ): TCatch<T, C> =>
    new TCatch({
      typeName: TTypeName.Catch,
      options,
      type,
      getCatchValue: (typeof catchValue === 'function'
        ? catchValue
        : () => catchValue) as () => C,
    })
}

export type AnyTCatch = TCatch<AnyTType, unknown>

/* -------------------------------------------------------------------------- */
/*                                    Array                                   */
/* -------------------------------------------------------------------------- */

export type TArrayCheck =
  | checks.Min
  | checks.Max
  | checks.Length
  | checks.SortAscending
  | checks.SortDescending

export type TArrayState = utils.MinMaxState
export type TArrayInitialState = utils.MinMaxInitialState
export type ComputeNextTArrayState<
  CurrState extends TArrayState,
  Method extends keyof utils.MinMaxState,
  Value extends number,
  Inclusive extends boolean
> = utils.ComputeNextMinMaxState<CurrState, Method, Value, Inclusive>

export type TArrayIO<
  T extends AnyTType,
  S extends TArrayState,
  IO extends '_I' | '_O'
> = utils.PositiveInfinity extends S['max']
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
  get hint() {
    const needsParens = this.element.isType(
      TTypeName.Tuple,
      TTypeName.Enum,
      TTypeName.Union,
      TTypeName.Optional,
      TTypeName.Nullable
    )

    return `${needsParens ? '(' : ''}${this.element.hint}${
      needsParens ? ')' : ''
    }[]`
  }

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
        case 'len':
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
            ctx.child({ type: this.element, data: value, path: [index] })
          )
          if (parseResult.ok) {
            result.push(parseResult.data)
          } else {
            if (ctx.common.abortEarly) {
              return parseResult
            }
          }
        }
        return ctx.isValid() ? ctx.OK(result as this['_O']) : ctx.ABORT()
      })
    } else {
      for (const [index, value] of entries) {
        const parseResult = this.element._parseSync(
          ctx.child({ type: this.element, data: value, path: [index] })
        )
        if (parseResult.ok) {
          result.push(parseResult.data)
        } else {
          if (ctx.common.abortEarly) {
            return parseResult
          }
        }
      }
      return ctx.isValid() ? ctx.OK(result as this['_O']) : ctx.ABORT()
    }
  }

  get element(): T {
    return this._def.element
  }

  /**
   * Specifies the minimum number of items in the array, where:
   *
   * @param value - The lowest number of array items allowed.
   */
  min<V extends number, I extends boolean = true>(
    value: V,
    options?: { readonly inclusive?: I; readonly message?: string },
    ..._errors: utils.$ValidateMinMax<S, 'min', V, I>
  ): TArray<T, ComputeNextTArrayState<S, 'min', V, I>> {
    return this._addCheck('min', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeChecks(['len']) as unknown as TArray<
      T,
      ComputeNextTArrayState<S, 'min', V, I>
    >
  }

  /**
   * Specifies the maximum number of items in the array, where:
   *
   * @param value - The highest number of array items allowed.
   */
  max<V extends number, I extends boolean = true>(
    value: V,
    options?: { readonly inclusive?: I; readonly message?: string },
    ..._errors: utils.$ValidateMinMax<S, 'max', V, I>
  ): TArray<T, ComputeNextTArrayState<S, 'max', V, I>> {
    return this._addCheck('max', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeChecks(['len']) as unknown as TArray<
      T,
      ComputeNextTArrayState<S, 'max', V, I>
    >
  }

  /**
   * Specifies the exact number of items in the array, where:
   *
   * @param value - The number of array items allowed.
   */
  length<V extends number>(
    value: V,
    options?: { readonly message?: string },
    ..._errors: utils.$ValidateNonNegativeInteger<V>
  ) {
    return this._addCheck('len', {
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
    element: T,
    options?: CreateOptions
  ): TArray<T> =>
    new TArray({ typeName: TTypeName.Array, options, checks: [], element })
}

export type AnyTArray = TArray<AnyTType>

/* -------------------------------------------------------------------------- */
/*                                    TSet                                    */
/* -------------------------------------------------------------------------- */

export type TSetCheck = checks.Min | checks.Max | checks.Size

export type TSetState = utils.MinMaxState
export type TSetInitialState = utils.MinMaxInitialState
export type ComputeNextTSetState<
  CurrState extends TSetState,
  Method extends keyof utils.MinMaxState,
  Value extends number,
  Inclusive extends boolean
> = utils.ComputeNextMinMaxState<CurrState, Method, Value, Inclusive>

export interface TSetDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Set
  readonly checks: readonly TSetCheck[]
  readonly element: T
}

export class TSet<
  T extends AnyTType,
  S extends TSetState = TSetInitialState
> extends TType<Set<T['_O']>, TSetDef<T>, Set<T['_I']>> {
  readonly hint: `Set<${T['hint']}>` = `Set<${this.element.hint}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!(ctx.data instanceof Set)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Set }).ABORT()
    }

    for (const check of this._def.checks) {
      switch (check.kind) {
        case 'min':
          if (
            (check.inclusive && ctx.data.size < check.value) ||
            (!check.inclusive && ctx.data.size <= check.value)
          ) {
            ctx.DIRTY(IssueKind.InvalidSet, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'max':
          if (
            (check.inclusive && ctx.data.size > check.value) ||
            (!check.inclusive && ctx.data.size >= check.value)
          ) {
            ctx.DIRTY(IssueKind.InvalidSet, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'size':
          if (ctx.data.size !== check.value) {
            ctx.DIRTY(IssueKind.InvalidSet, check)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
      }
    }

    const { element } = this._def
    const data = [...ctx.data.values()].map((v, i) => [v, i] as const)
    const result = new Set<T['_O']>()

    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        for (const [val, idx] of data) {
          const valResult = await element._parseAsync(
            ctx.child({ type: element, data: val, path: [idx] })
          )
          if (valResult.ok) {
            result.add(valResult.data)
          } else if (ctx.common.abortEarly) {
            return ctx.ABORT()
          }
        }
        return ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result)
      })
    } else {
      for (const [val, idx] of data) {
        const valResult = element._parseSync(
          ctx.child({ type: element, data: val, path: [idx] })
        )
        if (valResult.ok) {
          result.add(valResult.data)
        } else if (ctx.common.abortEarly) {
          return ctx.ABORT()
        }
      }
      return ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result)
    }
  }

  get element(): T {
    return this._def.element
  }

  /**
   * Specifies the minimum number of items in the Set, where:
   *
   * @param value - The lowest number of Set items allowed.
   */
  min<V extends number, I extends boolean = true>(
    value: V,
    options?: { readonly inclusive?: I; readonly message?: string },
    ..._errors: utils.$ValidateMinMax<S, 'min', V, I>
  ): TSet<T, ComputeNextTSetState<S, 'min', V, I>> {
    return this._addCheck('min', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeChecks(['size']) as unknown as TSet<
      T,
      ComputeNextTSetState<S, 'min', V, I>
    >
  }

  /**
   * Specifies the maximum number of items in the Set, where:
   *
   * @param value - The highest number of Set items allowed.
   */
  max<V extends number, I extends boolean = true>(
    value: V,
    options?: { readonly inclusive?: I; readonly message?: string },
    ..._errors: utils.$ValidateMinMax<S, 'max', V, I>
  ): TSet<T, ComputeNextTSetState<S, 'max', V, I>> {
    return this._addCheck('max', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeChecks(['size']) as unknown as TSet<
      T,
      ComputeNextTSetState<S, 'max', V, I>
    >
  }

  /**
   * Specifies the exact number of items in the Set, where:
   *
   * @param value - The number of Set items allowed.
   */
  size<V extends number>(
    value: V,
    options?: { readonly message?: string },
    ..._errors: utils.$ValidateNonNegativeInteger<V>
  ) {
    return this._addCheck('size', {
      value,
      message: options?.message,
    })._removeChecks(['min', 'max']) as unknown as TSet<T, { min: V; max: V }>
  }

  static create = <T extends AnyTType>(element: T, options?: CreateOptions) =>
    new TSet({ typeName: TTypeName.Set, options, element, checks: [] })
}

export type AnyTSet = TSet<AnyTType>

/* -------------------------------------------------------------------------- */
/*                                   TTuple                                   */
/* -------------------------------------------------------------------------- */

export type TTupleItems = readonly [AnyTType, ...AnyTType[]] | readonly []
export type TTupleRest = AnyTType

export type TTupleCheck = checks.Min | checks.Max

export type TTupleIO<
  T extends TTupleItems,
  R extends TTupleRest | null,
  IO extends '_I' | '_O'
> = T extends readonly [infer H extends AnyTType, ...infer R_]
  ? readonly [
      H[IO],
      ...(R_ extends readonly []
        ? R extends TTupleRest
          ? R[IO][]
          : []
        : R_ extends readonly [AnyTType]
        ? readonly [R_[0][IO], ...(R extends TTupleRest ? R[IO][] : [])]
        : R_ extends TTupleItems
        ? TTupleIO<R_, R, IO>
        : never)
    ]
  : never

export interface TTupleDef<T extends TTupleItems, R extends TTupleRest | null>
  extends TDef {
  readonly typeName: TTypeName.Tuple
  readonly checks: readonly TTupleCheck[]
  readonly items: T
  readonly rest: R
}

export class TTuple<
  T extends TTupleItems,
  R extends TTupleRest | null
> extends TType<TTupleIO<T, R, '_O'>, TTupleDef<T, R>, TTupleIO<T, R, '_I'>> {
  readonly hint = `readonly [${this.items.map((i) => i.hint).join(', ')}${
    this.restType ? `, ...${this.restType.array().hint}` : ''
  }]`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!Array.isArray(ctx.data)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Array }).ABORT()
    }

    const { items, rest } = this._def
    const data = ctx.data.map((i, idx) => [i, idx] as const)
    const result = [] as unknown[]

    if (data.length < items.length) {
      return ctx
        .DIRTY(IssueKind.InvalidTuple, {
          kind: 'min',
          value: items.length,
          inclusive: true,
        })
        .ABORT()
    }

    if (!rest && data.length > items.length) {
      return ctx
        .DIRTY(IssueKind.InvalidTuple, {
          kind: 'max',
          value: items.length,
          inclusive: true,
        })

        .ABORT()
    }

    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        for (const [val, idx] of data) {
          const valParser = items[idx] ?? rest
          const valResult = await valParser._parseAsync(
            ctx.child({ type: valParser, data: val, path: [idx] })
          )
          if (valResult.ok) {
            result.push(valResult.data)
          } else if (ctx.common.abortEarly) {
            return ctx.ABORT()
          }
        }
        return ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result as this['_O'])
      })
    } else {
      for (const [val, idx] of data) {
        const valParser = items[idx] ?? rest
        const valResult = valParser._parseSync(
          ctx.child({ type: valParser, data: val, path: [idx] })
        )
        if (valResult.ok) {
          result.push(valResult.data)
        } else if (ctx.common.abortEarly) {
          return ctx.ABORT()
        }
      }
      return ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result as this['_O'])
    }
  }

  get items(): T {
    return this._def.items
  }

  get restType(): R {
    return this._def.rest
  }

  rest<R_ extends TTupleRest>(rest: R_): TTuple<T, R_> {
    return new TTuple({ ...this._def, rest })
  }

  removeRest(): TTuple<T, null> {
    return new TTuple({ ...this._def, rest: null })
  }

  private static _create<T extends TTupleItems>(
    items: T,
    options?: CreateOptions
  ): TTuple<T, null>
  private static _create<T extends TTupleItems, R extends TTupleRest>(
    items: T,
    rest: R,
    options?: CreateOptions
  ): TTuple<T, R>
  private static _create<T extends TTupleItems, R extends TTupleRest>(
    items: T,
    restOrOptions?: R | CreateOptions,
    options?: CreateOptions
  ) {
    return new TTuple({
      typeName: TTypeName.Tuple,
      options: restOrOptions instanceof TType ? options : restOrOptions,
      items,
      rest: restOrOptions instanceof TType ? restOrOptions : null,
      checks: [],
    })
  }

  static create = this._create
}

export type AnyTTuple = TTuple<TTupleItems, TTupleRest | null>

/* -------------------------------------------------------------------------- */
/*                                   Record                                   */
/* -------------------------------------------------------------------------- */

export type TRecordIO<
  K extends AnyTType<PropertyKey>,
  V extends AnyTType,
  IO extends '_I' | '_O'
> = utils.Simplify<utils.EnforceOptional<Record<K[IO], V[IO]>>>

export interface TRecordDef<K extends AnyTType<PropertyKey>, V extends AnyTType>
  extends TDef {
  readonly typeName: TTypeName.Record
  readonly keys: K
  readonly values: V
}

export class TRecord<
  K extends AnyTType<PropertyKey>,
  V extends AnyTType
> extends TType<
  TRecordIO<K, V, '_O'>,
  TRecordDef<K, V>,
  TRecordIO<K, V, '_I'>
> {
  readonly hint: `Record<${K['hint']}, ${V['hint']}>` = `Record<${this.keys.hint}, ${this.values.hint}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!utils.isObject(ctx.data)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Object }).ABORT()
    }

    const { keys, values } = this._def
    const data = Reflect.ownKeys(ctx.data).map(
      (k) =>
        [
          typeof k === 'symbol' || Number.isNaN(+k) ? k : +k,
          (ctx.data as Record<typeof k, unknown>)[k],
        ] as const
    )
    const result = {} as Record<K['_O'], V['_O']>

    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        for (const [key, val] of data) {
          const stringifiedKey = String(key)
          const keyResult = await keys._parseAsync(
            ctx.child({
              type: keys,
              data: Number.isNaN(+stringifiedKey) ? key : +stringifiedKey,
              path: [typeof key === 'symbol' ? stringifiedKey : key],
            })
          )
          const valResult = await values._parseAsync(
            ctx.child({
              type: values,
              data: val,
              path: [typeof key === 'symbol' ? stringifiedKey : key],
            })
          )
          if (keyResult.ok && valResult.ok) {
            result[keyResult.data] = valResult.data
          } else if (ctx.common.abortEarly) {
            return ctx.ABORT()
          }
        }
        return ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result as any)
      })
    } else {
      for (const [key, val] of data) {
        const stringifiedKey = String(key)
        const keyResult = keys._parseSync(
          ctx.child({
            type: keys,
            data: Number.isNaN(+stringifiedKey) ? key : +stringifiedKey,
            path: [typeof key === 'symbol' ? stringifiedKey : key],
          })
        )
        const valResult = values._parseSync(
          ctx.child({
            type: values,
            data: val,
            path: [typeof key === 'symbol' ? stringifiedKey : key],
          })
        )
        if (keyResult.ok && valResult.ok) {
          result[keyResult.data] = valResult.data
        } else if (ctx.common.abortEarly) {
          return ctx.ABORT()
        }
      }
      return ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result as any)
    }
  }

  get keys(): K {
    return this._def.keys
  }

  get values(): V {
    return this._def.values
  }

  get entries(): readonly [K, V] {
    return [this.keys, this.values]
  }

  partial() {
    return new TRecord({ ...this._def, values: this.values.optional() })
  }

  private static _create<V extends AnyTType>(
    values: V,
    options?: CreateOptions
  ): TRecord<TString, V>
  private static _create<K extends AnyTType<PropertyKey>, V extends AnyTType>(
    keys: K,
    values: V,
    options?: CreateOptions
  ): TRecord<K, V>
  private static _create(
    valuesOrKeys: AnyTType<PropertyKey>,
    valuesOrOptions?: AnyTType | CreateOptions,
    options?: CreateOptions
  ) {
    return new TRecord({
      typeName: TTypeName.Record,
      options: valuesOrOptions instanceof TType ? options : valuesOrOptions,
      keys: valuesOrOptions instanceof TType ? valuesOrKeys : TString.create(),
      values: valuesOrOptions instanceof TType ? valuesOrOptions : valuesOrKeys,
    })
  }

  static create = this._create
}

export type AnyTRecord = TRecord<AnyTType<PropertyKey>, AnyTType>

/* -------------------------------------------------------------------------- */
/*                                    TMap                                    */
/* -------------------------------------------------------------------------- */

export interface TMapDef<K extends AnyTType, V extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Map
  readonly keys: K
  readonly values: V
}

export class TMap<K extends AnyTType, V extends AnyTType> extends TType<
  Map<K['_O'], V['_O']>,
  TMapDef<K, V>,
  Map<K['_I'], V['_I']>
> {
  readonly hint: `Map<${K['hint']}, ${V['hint']}>` = `Map<${this.keys.hint}, ${this.values.hint}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!(ctx.data instanceof Map)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Map }).ABORT()
    }

    const { keys, values } = this._def
    const data = [...ctx.data.entries()].map(([k, v], i) => [k, v, i] as const)
    const result = new Map<K['_I'], V['_I']>()

    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        for (const [key, val, idx] of data) {
          const keyResult = await keys._parseAsync(
            ctx.child({ type: keys, data: key, path: [idx, 'key'] })
          )
          const valResult = await values._parseAsync(
            ctx.child({ type: values, data: val, path: [idx, 'value'] })
          )
          if (keyResult.ok && valResult.ok) {
            result.set(keyResult.data, valResult.data)
          } else if (ctx.common.abortEarly) {
            return ctx.ABORT()
          }
        }
        return ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result)
      })
    } else {
      for (const [key, val, idx] of data) {
        const keyResult = keys._parseSync(
          ctx.child({ type: keys, data: key, path: [idx, 'key'] })
        )
        const valResult = values._parseSync(
          ctx.child({ type: values, data: val, path: [idx, 'value'] })
        )
        if (keyResult.ok && valResult.ok) {
          result.set(keyResult.data, valResult.data)
        } else if (ctx.common.abortEarly) {
          return ctx.ABORT()
        }
      }
      return ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result)
    }
  }

  get keys(): K {
    return this._def.keys
  }

  get values(): V {
    return this._def.values
  }

  get entries(): readonly [K, V] {
    return [this.keys, this.values]
  }

  static create = <K extends AnyTType, V extends AnyTType>(
    keys: K,
    values: V,
    options?: CreateOptions
  ): TMap<K, V> => new TMap({ typeName: TTypeName.Map, options, keys, values })
}

export type AnyTMap = TMap<AnyTType, AnyTType>

/* -------------------------------------------------------------------------- */
/*                                   Object                                   */
/* -------------------------------------------------------------------------- */

export type TObjectShape = { [x: string]: AnyTType }
export type TObjectUnknownKeys = 'passthrough' | 'strip' | 'strict'
export type TObjectCatchall = AnyTType

export type TObjectIO<
  S extends TObjectShape,
  UK extends TObjectUnknownKeys | null,
  C extends TObjectCatchall | null,
  IO extends '_I' | '_O'
> = utils.Simplify<
  utils.EnforceOptional<{ [K in keyof S]: S[K][IO] }>
> extends infer X
  ? { [K in keyof X]: X[K] } & (C extends TObjectCatchall
      ? { [x: string]: C[IO] }
      : UK extends 'passthrough'
      ? { [x: string]: unknown }
      : UK extends 'strict'
      ? { [x: string]: never }
      : unknown)
  : never

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
    ? deoptional(type.unwrapDeep())
    : type instanceof TNullable
    ? TNullable.create(deoptional(type.unwrapDeep()), type.options)
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
  readonly hint = `{ ${Object.entries(this.shape)
    .map(([k, v]) => `${k}${v.isOptional() ? '?' : ''}: ${v.hint}`)
    .join(', ')} }${
    this._def.catchall ||
    utils.includes(['passthrough', 'strict'], this._def.unknownKeys)
      ? ` & { [x: string]: ${
          this._def.catchall?.hint ??
          (this._def.unknownKeys === 'passthrough' ? 'unknown' : 'never')
        } }`
      : ''
  }`

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
          ctx.child({ type: keyParser, data: value, path: [key] })
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
            ctx.child({ type: catchall, data: value, path: [key] })
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

  augment<T extends TObjectShape>(
    augmentation: T
  ): TObject<utils.Merge<S, T>, UK, C>
  augment<T extends TObjectShape>(
    augmentation: AnyTObject<T>
  ): TObject<utils.Merge<S, T>, UK, C>
  augment<T extends TObjectShape>(
    augmentation: T | AnyTObject<T>
  ): TObject<utils.Merge<S, T>, UK, C>
  augment<T extends TObjectShape>(
    augmentation: T | AnyTObject<T>
  ): TObject<utils.Merge<S, T>, UK, C> {
    return this._setShape(
      utils.merge(
        this.shape,
        augmentation instanceof TObject ? augmentation.shape : augmentation
      )
    )
  }

  extend<T extends TObjectShape>(
    extension: T
  ): TObject<utils.Merge<S, T>, UK, C>
  extend<T extends TObjectShape>(
    extension: AnyTObject<T>
  ): TObject<utils.Merge<S, T>, UK, C>
  extend<T extends TObjectShape>(
    extension: T | AnyTObject<T>
  ): TObject<utils.Merge<S, T>, UK, C>
  extend<T extends TObjectShape>(
    extension: T | AnyTObject<T>
  ): TObject<utils.Merge<S, T>, UK, C> {
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

  private _setShape<S_ extends TObjectShape>(shape: S_) {
    return new TObject({ ...this._def, shape })
  }

  private _setUnknownKeys<UK_ extends TObjectUnknownKeys>(unknownKeys: UK_) {
    return new TObject({ ...this._def, unknownKeys, catchall: null })
  }

  private _setCatchall<C_ extends TObjectCatchall>(catchall: C_) {
    return new TObject({ ...this._def, catchall, unknownKeys: null })
  }

  static create = Object.assign(
    <S extends TObjectShape>(shape: S, options?: CreateOptions) =>
      new TObject({
        typeName: TTypeName.Object,
        options,
        shape,
        unknownKeys: 'strip',
        catchall: null,
      }),
    {
      passthrough: <S extends TObjectShape>(
        shape: S,
        options?: CreateOptions
      ) => this.create(shape, options).passthrough(),
      strict: <S extends TObjectShape>(shape: S, options?: CreateOptions) =>
        this.create(shape, options).strict(),
      lazy: <S extends TObjectShape>(shape: () => S, options?: CreateOptions) =>
        this.create(shape(), options),
    }
  )
}

export type AnyTObject<S extends TObjectShape = TObjectShape> = TObject<
  S,
  TObjectUnknownKeys | null,
  TObjectCatchall | null
>

/* -------------------------------------------------------------------------- */
/*                                  Function                                  */
/* -------------------------------------------------------------------------- */

export interface TFunctionDef<A extends AnyTTuple, R extends AnyTType>
  extends TDef {
  readonly typeName: TTypeName.Function
  readonly args: A
  readonly returns: R
}

export class TFunction<A extends AnyTTuple, R extends AnyTType> extends TType<
  (...args: A['_I']) => R['_O'],
  TFunctionDef<A, R>,
  (...args: A['_O']) => R['_I']
> {
  readonly hint = `(${this.parameters.items
    .map((i, idx) => `args_${idx}: ${i.hint}`)
    .join(', ')}${
    this.parameters.restType
      ? `, ...args_${this.parameters.items.length}: ${this.parameters.restType.hint}[]`
      : ''
  }) => ${this.returnType.hint}`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!(typeof ctx.data === 'function')) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Function }).ABORT()
    }

    const { args: argsType, returns: returnType } = this._def
    const fn = ctx.data
    const parseOptions = ctx.common

    if (returnType instanceof TPromise) {
      return ctx.OK(async (...args: readonly unknown[]) => {
        const parsedArgs = await argsType.safeParseAsync(args, parseOptions)
        if (!parsedArgs.ok) {
          throw ParseContext.createAsync(argsType, args, parseOptions)
            .INVALID_ARGUMENTS({ error: parsedArgs.error })
            .ABORT().error
        }
        const result = await fn(...(parsedArgs.data as readonly unknown[]))
        const parsedResult = await returnType.safeParseAsync(
          result,
          parseOptions
        )
        if (!parsedResult.ok) {
          throw ParseContext.createAsync(returnType, result, ctx.common)
            .INVALID_RETURN_TYPE({ error: parsedResult.error })
            .ABORT().error
        }
        return parsedResult.data
      })
    } else {
      return ctx.OK((...args: readonly unknown[]) => {
        const parsedArgs = argsType.safeParse(args, parseOptions)
        if (!parsedArgs.ok) {
          throw ParseContext.createAsync(argsType, args, parseOptions)
            .INVALID_ARGUMENTS({ error: parsedArgs.error })
            .ABORT().error
        }
        const result = fn(...(parsedArgs.data as readonly unknown[]))
        const parsedResult = returnType.safeParse(result, parseOptions)
        if (!parsedResult.ok) {
          throw ParseContext.createAsync(returnType, result, ctx.common)
            .INVALID_RETURN_TYPE({ error: parsedResult.error })
            .ABORT().error
        }
        return parsedResult.data
      })
    }
  }

  get parameters(): A {
    return this._def.args
  }

  get returnType(): R {
    return this._def.returns
  }

  args<A_ extends TTupleItems>(args: A_): TFunction<TTuple<A_, null>, R>
  args<A_ extends TTupleItems, AR_ extends TTupleRest>(
    args: A_,
    rest: AR_
  ): TFunction<TTuple<A_, AR_>, R>
  args<A_ extends TTupleItems, AR_ extends TTupleRest>(args: A_, rest?: AR_) {
    return new TFunction({
      ...this._def,
      args: rest ? TTuple.create(args, rest) : TTuple.create(args),
    })
  }

  returns<R_ extends AnyTType>(returns: R_): TFunction<A, R_> {
    return new TFunction({ ...this._def, returns })
  }

  implement<F extends (...args: A['_O']) => R['_I']>(
    fn: F
  ): ReturnType<F> extends R['_O']
    ? (...args: A['_I']) => ReturnType<F>
    : (...args: A['_I']) => R['_O'] {
    return this.parse(fn) as ReturnType<F> extends R['_O']
      ? (...args: A['_I']) => ReturnType<F>
      : (...args: A['_I']) => R['_O']
  }

  strictImplement(
    fn: (...args: A['_O']) => R['_I']
  ): (...args: A['_O']) => R['_I'] {
    return this.parse(fn)
  }

  validate<F extends (...args: A['_O']) => R['_I']>(fn: F) {
    return this.implement(fn)
  }

  private static _create<A extends TTupleItems>(
    args: A,
    options?: CreateOptions
  ): TFunction<TTuple<A, null>, TUnknown>
  private static _create<A extends AnyTTuple>(
    args: A,
    options?: CreateOptions
  ): TFunction<A, TUnknown>
  private static _create<A extends TTupleItems, R extends AnyTType>(
    args: A,
    returns: R,
    options?: CreateOptions
  ): TFunction<TTuple<A, null>, R>
  private static _create<A extends AnyTTuple, R extends AnyTType>(
    args: A,
    returns: R,
    options?: CreateOptions
  ): TFunction<A, R>
  private static _create(
    options?: CreateOptions
  ): TFunction<TTuple<[], null>, TUnknown>
  private static _create(
    argsOrOptions?: TTupleItems | AnyTTuple | CreateOptions,
    returnsOrOptions?: AnyTType | CreateOptions,
    options?: CreateOptions
  ): TFunction<any, any> {
    return new TFunction({
      typeName: TTypeName.Function,
      options:
        argsOrOptions instanceof TTuple || utils.isArray(argsOrOptions)
          ? returnsOrOptions instanceof TType
            ? options
            : returnsOrOptions
          : argsOrOptions,
      args:
        argsOrOptions instanceof TTuple
          ? argsOrOptions
          : utils.isArray(argsOrOptions)
          ? TTuple.create(argsOrOptions)
          : TTuple.create([]),
      returns:
        returnsOrOptions instanceof TType
          ? returnsOrOptions
          : TUnknown.create(),
      checks: [],
    })
  }

  static create = this._create
}

export type AnyTFunction = TFunction<AnyTTuple, AnyTType>

/* -------------------------------------------------------------------------- */
/*                                    Union                                   */
/* -------------------------------------------------------------------------- */

export type TUnionMembers = readonly [AnyTType, AnyTType, ...AnyTType[]]

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
    const handleResults = (
      results: readonly SyncParseResultOf<this>[]
    ): ParseResultOf<this> => {
      const successfulResults = results.filter((result) => !!result.ok)
      return successfulResults.length > 0
        ? ctx.OK(successfulResults[0].data)
        : ctx
            .INVALID_UNION({
              errors: results
                .map((result) => result.error)
                .filter(utils.isDefined),
            })
            .ABORT()
    }

    if (ctx.common.async) {
      return Promise.all(
        this.members.map((member) =>
          member._parseAsync(ctx.clone({ type: member }))
        )
      ).then(handleResults)
    } else {
      const results = this.members.map((member) =>
        member._parseSync(ctx.clone({ type: member }))
      )
      return handleResults(results)
    }
  }

  get members(): T {
    return this._def.members
  }

  static create = <T extends TUnionMembers>(
    members: T,
    options?: CreateOptions
  ): TUnion<T> => new TUnion({ typeName: TTypeName.Union, options, members })
}

export type AnyTUnion = TUnion<TUnionMembers>

/* -------------------------------------------------------------------------- */
/*                                Intersection                                */
/* -------------------------------------------------------------------------- */

export type TIntersectionMembers = readonly [AnyTType, AnyTType, ...AnyTType[]]

export type TIntersectionMemberResults<T extends TIntersectionMembers> = {
  [K in keyof T]: SyncParseResultOf<T[K]>
}

export interface TIntersectionDef<T extends TIntersectionMembers> extends TDef {
  readonly typeName: TTypeName.Intersection
  readonly members: T
}

export interface SuccessfulIntersectionResult<T, U> {
  readonly valid: true
  readonly value: T & U
}

export interface FailedIntersectionResult {
  readonly valid: false
  readonly value?: never
}

export type IntersectionResult<T, U> =
  | SuccessfulIntersectionResult<T, U>
  | FailedIntersectionResult

const intersect = <O>(outputs: readonly SuccessfulParseResult<O>[]) => {
  const intersectTwo = <T, U>(a: T, b: U): IntersectionResult<T, U> => {
    const aType = getParsedType(a)
    const bType = getParsedType(b)

    if (aType === bType) {
      return { valid: true, value: a as T & U }
    } else if (utils.isObject(a) && utils.isObject(b)) {
      const bKeys = Object.keys(b)
      const sharedKeys = Object.keys(a).filter(
        (k) => bKeys.indexOf(k) !== -1
      ) as unknown as readonly (keyof (T | U))[]
      const intersected = { ...a, ...b } as T & U
      for (const key of sharedKeys) {
        const intersectedValue = intersectTwo(a[key], b[key])
        if (!intersectedValue.valid) {
          return { valid: false }
        }
        intersected[key] = intersectedValue.value
      }
      return { valid: true, value: intersected }
    } else if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) {
        return { valid: false }
      }
      const intersected = a.map((aItem, i) => intersectTwo(aItem, b[i]))
      if (intersected.some((i) => !i.valid)) {
        return { valid: false }
      }
      return {
        valid: true,
        value: intersected.map(
          (i) => (i as SuccessfulIntersectionResult<T, U>).value
        ) as T & U,
      }
    } else if (a instanceof Date && b instanceof Date && +a === +b) {
      return { valid: true, value: a as T & U }
    } else {
      return { valid: false }
    }
  }

  return outputs
    .slice(2)
    .reduce(
      (a, b) => intersectTwo(a.value, b.data),
      intersectTwo(outputs[0].data, outputs[1].data)
    )
}

export class TIntersection<T extends TIntersectionMembers> extends TType<
  utils.UnionToIntersection<T[number]['_O']>,
  TIntersectionDef<T>,
  utils.UnionToIntersection<T[number]['_I']>
> {
  readonly hint = this.members.map((m) => m.hint).join(' & ')

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const handleIntersection = <
      O,
      I,
      T extends readonly SyncParseResult<O, I>[]
    >(
      results: T
    ): ParseResultOf<this> => {
      if (results.some((res) => !res.ok)) {
        return ctx.ABORT()
      }
      const data = intersect(
        results as readonly SuccessfulParseResult<this['_O']>[]
      )
      if (data.valid) {
        return ctx.OK(data.value)
      } else {
        return ctx.INVALID_INTERSECTION().ABORT()
      }
    }

    if (ctx.common.async) {
      return Promise.all(
        this.members.map((member) =>
          member._parseAsync(ctx.clone({ type: member }))
        )
      ).then(handleIntersection)
    } else {
      const results = this.members.map((member) =>
        member._parseSync(ctx.clone({ type: member }))
      )
      return handleIntersection(results)
    }
  }

  get members(): T {
    return this._def.members
  }

  static create = <T extends TIntersectionMembers>(
    members: T,
    options?: CreateOptions
  ): TIntersection<T> =>
    new TIntersection({ typeName: TTypeName.Intersection, options, members })
}

export type AnyTIntersection = TIntersection<TIntersectionMembers>

/* -------------------------------------------------------------------------- */
/*                                   Effects                                  */
/* -------------------------------------------------------------------------- */

export enum EffectKind {
  Preprocess = 'preprocess',
  Refinement = 'refinement',
  Transform = 'transform',
}

export interface EffectContext<O, I = O> {
  readonly issue: ParseContext<unknown, O, I>['DIRTY']
  readonly path: ParsePath
}

export type EffectContextOf<T extends AnyTType> = EffectContext<
  T['_O'],
  T['_I']
>

const createEffectContext = <O, I = O>(
  parseCtx: ParseContext<unknown, O, I>
): EffectContext<O, I> => ({
  issue: (...args) => parseCtx['DIRTY'](...args),
  path: [...parseCtx.path],
})

export interface BaseEffect<K extends EffectKind> {
  readonly kind: K
}

export interface PreprocessEffect<T> extends BaseEffect<EffectKind.Preprocess> {
  readonly transform: (data: unknown) => T
}

export interface RefinementEffect<T extends AnyTType>
  extends BaseEffect<EffectKind.Refinement> {
  readonly refine: (
    data: T['_O'],
    ctx: EffectContextOf<T>
  ) => boolean | Promise<boolean>
}

export interface TransformEffect<T extends AnyTType, O>
  extends BaseEffect<EffectKind.Transform> {
  readonly transform: (data: T['_O'], ctx: EffectContextOf<T>) => O | Promise<O>
}

export type TEffect<T = unknown, U = unknown> =
  | PreprocessEffect<T>
  | RefinementEffect<T & AnyTType>
  | TransformEffect<T & AnyTType, U>

export type RefinementMsgParams = RequireAtLeastOne<
  Issue<IssueKind.Custom>['payload']
> & { readonly message: string }

export type RefinementMsgArg<T> =
  | string
  | RefinementMsgParams
  | ((data: T) => RefinementMsgParams)

type RefinementExecutorCreator<Async extends boolean = false> = <
  T extends AnyTType
>(
  effect: RefinementEffect<T>,
  effectCtx: EffectContext<T>
) => (data: T) => Async extends true ? Promise<boolean> : boolean

const createSyncRefinementExecutor: RefinementExecutorCreator =
  (effect, effectCtx) => (data) => {
    const result = effect.refine(data, effectCtx)
    if (result instanceof Promise) {
      throw new TypeError(
        'Async refinement encountered during synchronous parse operation. Use `.parseAsync` instead.'
      )
    }
    return result
  }

const createAsyncRefinementExecutor: RefinementExecutorCreator<true> =
  (effect, effectCtx) => async (data) =>
    effect.refine(data, effectCtx)

export interface TEffectsDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Effects
  readonly type: T
  readonly effect: TEffect
}

export type GetTEffectsSource<T> = T extends AnyTEffects ? T['source'] : T

export class TEffects<
  T extends AnyTType<any>,
  O = T['_O'],
  I = T['_I']
> extends TType<O, TEffectsDef<T>, I> {
  readonly hint: string = this.source.hint

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const { effect } = this._def

    if (effect.kind === EffectKind.Preprocess) {
      const processed = effect.transform(ctx.data)
      return ctx.common.async
        ? Promise.resolve(processed).then((processedAsync) => {
            ctx.setData(processedAsync as O)
            return this.underlying._parseAsync(
              ctx.clone({ type: this.underlying })
            )
          })
        : ctx.setData(processed as O) &&
            this.underlying._parseSync(ctx.clone({ type: this.underlying }))
    }

    const effectCtx = createEffectContext(ctx)

    if (effect.kind === EffectKind.Refinement) {
      if (ctx.common.async) {
        const executeRefinement = createAsyncRefinementExecutor(
          effect,
          effectCtx
        )
        return this.underlying
          ._parseAsync(ctx.clone({ type: this.underlying }))
          .then((underlyingRes) =>
            underlyingRes.ok
              ? executeRefinement(underlyingRes.data).then((refinementRes) =>
                  refinementRes ? ctx.OK(underlyingRes.data) : ctx.ABORT()
                )
              : ctx.ABORT()
          )
      } else {
        const executeRefinement = createSyncRefinementExecutor(
          effect,
          effectCtx
        )
        const underlyingRes = this.underlying._parseSync(
          ctx.clone({ type: this.underlying })
        )
        return underlyingRes.ok && executeRefinement(underlyingRes.data)
          ? ctx.OK(underlyingRes.data)
          : ctx.ABORT()
      }
    }

    if (effect.kind === EffectKind.Transform) {
      if (ctx.common.async) {
        return this.underlying
          ._parseAsync(ctx.clone({ type: this.underlying }))
          .then((baseRes) => {
            if (!baseRes.ok) {
              return ctx.ABORT()
            }
            return Promise.resolve(
              effect.transform(baseRes.data, effectCtx)
            ).then((result) =>
              ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result as T['_O'])
            )
          })
      } else {
        const baseRes = this.underlying._parseSync(
          ctx.clone({ type: this.underlying })
        )
        if (!baseRes.ok) {
          return ctx.ABORT()
        }
        const result = effect.transform(baseRes.data, effectCtx)
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
    return this._def.type
  }

  get source(): GetTEffectsSource<T> {
    return this.underlying instanceof TEffects
      ? this.underlying.source
      : this.underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): GetTEffectsSource<T> {
    return this.source
  }

  private static _create = <
    T extends AnyTType,
    O = T['_O'],
    I = T['_I'],
    E extends TEffect = TEffect
  >(
    type: T,
    effect: E,
    options: CreateOptions | undefined
  ) =>
    new TEffects<T, O, I>({
      typeName: TTypeName.Effects,
      options,
      type,
      effect,
    })

  private static _refine<T extends AnyTType, O extends T['_O']>(
    type: T,
    check: (data: T['_O']) => data is O,
    message?: RefinementMsgArg<T['_O']>,
    options?: CreateOptions
  ): TEffects<T, O>
  private static _refine<T extends AnyTType, U>(
    type: T,
    check: (data: T['_O']) => U | Promise<U>,
    message?: RefinementMsgArg<T['_O']>,
    options?: CreateOptions
  ): TEffects<T>
  private static _refine<T extends AnyTType>(
    type: T,
    check: (data: T['_O']) => unknown,
    message?: RefinementMsgArg<T['_O']>,
    options?: CreateOptions
  ): TEffects<T> {
    return TEffects._create<T, T['_O'], T['_I'], RefinementEffect<T>>(
      type,
      {
        kind: EffectKind.Refinement,
        refine: (data, ctx) => {
          const abort = () => {
            const getIssuePayload = (): Issue<IssueKind.Custom>['payload'] => {
              if (!message || typeof message === 'string') {
                return { message }
              } else if (typeof message === 'function') {
                return message(data)
              } else {
                return message
              }
            }
            const issuePayload = getIssuePayload()
            ctx.issue(IssueKind.Custom, issuePayload, issuePayload.message)
            return false
          }
          const result = check(data)
          if (result instanceof Promise) {
            return result.then((resolvedResult) => !!resolvedResult || abort())
          }
          return !!result || abort()
        },
      },
      options
    )
  }

  static preprocess = <I, O, T extends AnyTType<O, I>>(
    preprocess: (data: unknown) => I,
    type: T,
    options?: CreateOptions
  ): TEffects<T> =>
    TEffects._create<T, O, I, PreprocessEffect<I>>(
      type,
      { kind: EffectKind.Preprocess, transform: preprocess },
      options
    )

  static refine = this._refine

  static transform = <T extends AnyTType, O>(
    type: T,
    transform: (data: T['_O'], ctx: EffectContextOf<T>) => O | Promise<O>,
    options?: CreateOptions
  ): TEffects<T, O> =>
    TEffects._create<T, O, T['_I'], TransformEffect<T, O>>(
      type,
      { kind: EffectKind.Transform, transform },
      options
    )
}

export type AnyTEffects = TEffects<AnyTType>

/* -------------------------------------------------------------------------- */
/*                                  Pipeline                                  */
/* -------------------------------------------------------------------------- */

export interface TPipelineDef<In extends AnyTType, Out extends AnyTType>
  extends TDef {
  readonly typeName: TTypeName.Pipeline
  readonly in: In
  readonly out: Out
}

export class TPipeline<In extends AnyTType, Out extends AnyTType> extends TType<
  Out['_O'],
  TPipelineDef<In, Out>,
  In['_I']
> {
  readonly hint: `Pipeline<${Out['hint']}, ${In['hint']}>` = `Pipeline<${this.out['hint']}, ${this.in['hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const inRes = await this.in._parseAsync(ctx.clone({ type: this.in }))
        if (!inRes.ok) {
          return ctx.ABORT()
        }
        ctx.setData(inRes.data)
        return this.out._parseAsync(ctx.clone({ type: this.out }))
      })
    } else {
      const inRes = this.in._parseSync(ctx.clone({ type: this.in }))
      if (!inRes.ok) {
        return ctx.ABORT()
      }
      ctx.setData(inRes.data)
      return this.out._parseSync(ctx.clone({ type: this.out }))
    }
  }

  get in(): In {
    return this._def.in
  }

  get out(): Out {
    return this._def.out
  }

  static create = <
    A,
    B,
    C,
    In extends AnyTType<B, A>,
    Out extends AnyTType<C, B>
  >(
    a: In,
    b: Out,
    options?: CreateOptions
  ): TPipeline<In, Out> =>
    new TPipeline<In, Out>({
      typeName: TTypeName.Pipeline,
      options,
      in: a,
      out: b,
    })
}

export type AnyTPipeline = TPipeline<AnyTType, AnyTType>

/* -------------------------------------------------------------------------- */
/*                                   Extras                                   */
/* -------------------------------------------------------------------------- */

const TNullish = {
  create: <T extends AnyTType>(underlying: T, options?: CreateOptions) =>
    TOptional.create(TNullable.create(underlying, options), options),
}

/* -------------------------------------------------------------------------- */

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
  Pipeline = 'TPipeline',
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
  [TTypeName.Function]: AnyTFunction
  [TTypeName.InstanceOf]: AnyTInstanceOf
  [TTypeName.Intersection]: AnyTIntersection
  [TTypeName.Lazy]: AnyTLazy
  [TTypeName.Literal]: AnyTLiteral
  [TTypeName.Map]: AnyTMap
  [TTypeName.NaN]: TNaN
  [TTypeName.Never]: TNever
  [TTypeName.Null]: TNull
  [TTypeName.Nullable]: AnyTNullable
  [TTypeName.Number]: TNumber
  [TTypeName.Object]: AnyTObject
  [TTypeName.Optional]: AnyTOptional
  [TTypeName.Pipeline]: AnyTPipeline
  [TTypeName.Promise]: AnyTPromise
  [TTypeName.Record]: AnyTRecord
  [TTypeName.Set]: AnyTSet
  [TTypeName.String]: TString
  [TTypeName.Symbol]: TSymbol
  [TTypeName.True]: TTrue
  [TTypeName.Tuple]: AnyTTuple
  [TTypeName.Undefined]: TUndefined
  [TTypeName.Union]: AnyTUnion
  [TTypeName.Unknown]: TUnknown
  [TTypeName.Void]: TVoid
}

/* -------------------------------------------------------------------------- */

export const tany = TAny.create
export const tarray = TArray.create
export const tbigint = TBigInt.create
export const tboolean = TBoolean.create
export const tbool = TBoolean.create // alias for `tboolean`
export const tbranded = TBranded.create
export const tcatch = TCatch.create
export const tdate = TDate.create
export const tenum = TEnum.create
export const tfalse = TFalse.create
export const tfunction = TFunction.create
export const tfn = TFunction.create // alias for `tfunction`
export const tinstanceof = TInstanceOf.create
export const tintersection = TIntersection.create
export const tlazy = TLazy.create
export const tliteral = TLiteral.create
export const tmap = TMap.create
export const tnan = TNaN.create
export const tnever = TNever.create
export const tnull = TNull.create
export const tnullable = TNullable.create
export const tnullish = TNullish.create
export const tnumber = TNumber.create
export const tobject = TObject.create
export const toptional = TOptional.create
export const tpipeline = TPipeline.create
export const tpromise = TPromise.create
export const trecord = TRecord.create
export const tset = TSet.create
export const tstring = TString.create
export const tsymbol = TSymbol.create
export const ttrue = TTrue.create
export const ttuple = TTuple.create
export const tundefined = TUndefined.create
export const tunion = TUnion.create
export const tunknown = TUnknown.create
export const tvoid = TVoid.create
// TEffects
export const tpreprocess = TEffects.preprocess
export const trefine = TEffects.refine
export const ttransform = TEffects.transform
// TGlobal
export const tglobal = () => TGlobal

export {
  tany as any,
  tarray as array,
  tbigint as bigint,
  tbool as bool,
  tboolean as boolean,
  tbranded as branded,
  tcatch as catch,
  tdate as date,
  tenum as enum,
  tfalse as false,
  tfn as fn,
  tfunction as function,
  tglobal as global,
  tinstanceof as instanceof,
  tintersection as intersection,
  tlazy as lazy,
  tliteral as literal,
  tmap as map,
  tnan as nan,
  tnever as never,
  tnull as null,
  tnullable as nullable,
  tnullish as nullish,
  tnumber as number,
  tobject as object,
  toptional as optional,
  tpipeline as pipeline,
  tpreprocess as preprocess,
  tpromise as promise,
  trecord as record,
  trefine as refine,
  tset as set,
  tstring as string,
  tsymbol as symbol,
  ttransform as transform,
  ttrue as true,
  ttuple as tuple,
  tundefined as undefined,
  tunion as union,
  tunknown as unknown,
  tvoid as void,
}

/* -------------------------------------------------------------------------- */

export type output<T extends AnyTType> = utils.FixEmptyObject<T['_O']>
export type input<T extends AnyTType> = utils.FixEmptyObject<T['_I']>
export type infer<T extends AnyTType> = output<T>
