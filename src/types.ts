import { blue, cyan, magenta, red, yellow } from 'colorette'
import type { Dayjs } from 'dayjs'
import type { N } from 'ts-toolbelt'
import type { RequireAtLeastOne } from 'type-fest'
import type { ErrorMap, inferFlattenedError, inferFormattedError } from './error'
import { TGlobal } from './global'
import { IssueKind, type Issue, type checks } from './issues'
import {
  ParseContext,
  TParsedType,
  getParsedType,
  type AsyncParseResult,
  type AsyncParseResultOf,
  type FailedParseResultOf,
  type ParseContextOf,
  type ParseOptions,
  type ParsePath,
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
  readonly color?: string
  readonly debug?: boolean
}

export interface TPublicMeta<O = unknown> {
  readonly title?: string
  readonly summary?: string
  readonly description?: string
  readonly version?: string
  readonly examples?: readonly O[]
  readonly tags?: readonly string[]
  readonly unit?: string
  readonly deprecated?: boolean
  readonly [x: string]: unknown
}

export interface TMeta<O = unknown> extends TPublicMeta<O> {
  readonly required?: boolean
  readonly nullable?: boolean
  readonly readonly?: boolean
}

export interface TDef<O = any> {
  readonly typeName: TTypeName
  readonly options: TOptions | undefined
  readonly meta?: TMeta<O>
  readonly rules?: readonly { readonly check: string }[]
}

export abstract class TType<O, Def extends TDef<O>, I = O> {
  readonly _O!: O
  readonly _I!: I

  readonly _def: Def & { readonly options: TOptions; readonly meta: TMeta<O> }

  abstract _parse(ctx: ParseContext<O, I>): ParseResultOf<this>

  protected abstract readonly _hint: string

  // readonly id: string = nanoid()

  get typeName(): Def['typeName'] {
    return this._def.typeName
  }

  show({ colors = true }: { readonly colors?: boolean }): string {
    if (!colors || !TGlobal.getOptions().colors) {
      return this['_hint']
    }
    return this['_hint'].replace(
      /(\s\d*\s)|("\w*")|(\[)(\w*)(:)|(args(?:_\d*)?)|([?|&]|\.{3}|readonly)|(\w*(?!\??:|"))/g,
      `${blue('$1')}${yellow('$2')}$3${red('$4')}$5${red('$6')}${magenta('$7')}${cyan('$8')}`
    )
  }

  get options(): TOptions {
    return this._def.options
  }

  setOptions(options: TOptions): this {
    return this._construct({ options })
  }

  get meta(): TMeta<O> {
    return this._def.meta
  }

  setMeta(meta: TPublicMeta<O>): this {
    return this._construct({ meta })
  }

  protected constructor(def: Def) {
    this._def = {
      ...def,
      options: { ...def.options },
      meta: { required: true, nullable: false, readonly: false, ...def.meta },
    }

    this._parse = utils.memoize(this._parse.bind(this))
    this._parseSync = this._parseSync.bind(this)
    this._parseAsync = this._parseAsync.bind(this)
    this.safeParse = this.safeParse.bind(this)
    this.parse = this.parse.bind(this)
    this.safeParseAsync = this.safeParseAsync.bind(this)
    this.parseAsync = this.parseAsync.bind(this)
    this.is = this.is.bind(this)
    this.guard = this.guard.bind(this)
    this.optional = this.optional.bind(this)
    this.nullable = this.nullable.bind(this)
    this.nullish = this.nullish.bind(this)
    this.required = this.required.bind(this)
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
    this.isNullish = this.isNullish.bind(this)
    this.isType = this.isType.bind(this)

    Object.getOwnPropertyNames(this)
      .filter((prop) => prop.match(/^\$?_/))
      .forEach((prop) => Object.defineProperty(this, prop, { enumerable: false }))
  }

  _parseSync(ctx: ParseContext<O, I>): SyncParseResultOf<this> {
    const result = this._parse(ctx)
    if (result instanceof Promise) {
      throw new Error('Synchronous parse encountered promise')
    }
    return result
  }

  async _parseAsync(ctx: ParseContext<O, I>): AsyncParseResultOf<this> {
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

  safeParseAsync(data: unknown, options?: ParseOptions): AsyncParseResultOf<this> {
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

  required(this: AnyTObject): any
  required(this: this): TRequired<this>
  required() {
    return TRequired.create(this, this.options)
  }

  or<T extends [AnyTType, ...AnyTType[]]>(...types: T): TUnion<[this, T[0], ...utils.Tail<T>]> {
    return TUnion.create([this, types[0], ...utils.tail(types)], this.options)
  }

  and<T extends [AnyTType, ...AnyTType[]]>(...types: T): TIntersection<[this, T[0], ...utils.Tail<T>]> {
    return TIntersection.create([this, types[0], ...utils.tail(types)], this.options)
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

  default<D extends utils.Defined<I>>(defaultValue: D | (() => D)): TDefault<this, D> {
    return TDefault.create(this, defaultValue, this.options)
  }

  catch<C extends I>(catchValue: C | (() => C)): TCatch<this, C> {
    return TCatch.create(this, catchValue, this.options)
  }

  lazy(): TLazy<this> {
    return TLazy.create(() => this, this.options)
  }

  refine<O_ extends O>(check: (data: O) => data is O_, message?: RefinementMsgArg<O>): TEffects<this, O_>
  refine<T>(check: (data: O) => T | Promise<T>, message?: RefinementMsgArg<O>): TEffects<this>
  refine(check: (data: O) => unknown, message?: RefinementMsgArg<O>): TEffects<this> {
    return TEffects.refine(this, check, message, this.options)
  }

  transform<O_>(transform: (data: O, ctx: EffectContextOf<this>) => O_ | Promise<O_>): TEffects<this, O_> {
    return TEffects.transform(this, transform, this.options)
  }

  preprocess(preprocess: (data: unknown) => I): TEffects<this> {
    return TEffects.preprocess(preprocess, this, this.options)
  }

  pipe<O_, T extends AnyTType<O_, I>>(type: T): TPipeline<this, T> {
    return TPipeline.create(this, type)
  }

  isOptional(): boolean {
    return !this.meta.required
  }

  isNullable(): boolean {
    return !!this.meta.nullable
  }

  isNullish(): boolean {
    return this.isNullable() && this.isOptional()
  }

  isType<T extends TTypeName>(...types: readonly [T, ...T[]]): this is TTypeNameMap[T] {
    return utils.includes(types, this.typeName)
  }

  protected _addRule<K extends utils.Defined<Def['rules']>[number]['check']>(
    check: K,
    payload: Omit<Extract<utils.Defined<Def['rules']>[number], { readonly check: K }>, 'check'>
  ): this {
    return this._construct({
      rules: (this._def.rules ?? []).filter((c) => c.check === check).concat({ check, ...payload }),
    })
  }

  protected _removeRules<K extends utils.Defined<Def['rules']>[number]['check']>(checks: readonly [K, ...K[]]): this {
    return this._construct({ rules: (this._def.rules ?? []).filter((c) => utils.includes(checks, c.check)) })
  }

  protected _construct(def: Partial<TDef>): this {
    return Reflect.construct(this.constructor as new (def: Def) => this, [
      utils.mergeDeep(utils.cloneDeep(this._def), def),
    ])
  }
}

export type AnyTType<O = unknown, I = O> = TType<O, TDef, I>

/* ---------------------------------------------------------------------------------------------- */
/*                                               Any                                              */
/* ---------------------------------------------------------------------------------------------- */

export interface TAnyDef extends TDef {
  readonly typeName: TTypeName.Any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class TAny extends TType<any, TAnyDef> {
  protected readonly _hint = 'any'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.OK(ctx.data)
  }

  static create = (options?: CreateOptions): TAny =>
    new TAny({ typeName: TTypeName.Any, options, meta: { required: false, nullable: true } })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                             Unknown                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TUnknownDef extends TDef {
  readonly typeName: TTypeName.Unknown
}

export class TUnknown extends TType<unknown, TUnknownDef> {
  protected readonly _hint = 'unknown'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.OK(ctx.data)
  }

  static create = (options?: CreateOptions): TUnknown =>
    new TUnknown({ typeName: TTypeName.Unknown, options, meta: { required: false, nullable: true } })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                             String                                             */
/* ---------------------------------------------------------------------------------------------- */

export type TStringCheck =
  | checks.Min
  | checks.Max
  | checks.Length
  | checks.Make<'pattern', { readonly pattern: RegExp; readonly name: string }>
  | checks.Make<'alphanum', null>
  | checks.Make<'cuid', null>
  | checks.Make<'data_uri', null>
  | checks.Make<'email', null>
  | checks.Make<'hex', null>
  | checks.Make<'iso_date', null>
  | checks.Make<'iso_duration', null>
  | checks.Make<'uuid', null>
  | checks.Make<'url', null>
  | checks.Make<'trim', null>
  | checks.Make<'starts_with', { readonly prefix: string }>
  | checks.Make<'ends_with', { readonly suffix: string }>
  | checks.Make<'lowercase', { readonly convert: boolean }>
  | checks.Make<'uppercase', { readonly convert: boolean }>

export interface TStringState {
  coerce: boolean
  case: 'none' | 'lower' | 'upper'
}

export interface TStringDef extends TDef {
  readonly typeName: TTypeName.String
  readonly rules: readonly TStringCheck[]
  readonly coerce: boolean
}

export class TString<S extends TStringState = TStringState> extends TType<
  { none: string; lower: Lowercase<string>; upper: Uppercase<string> }[S['case']],
  TStringDef
> {
  protected readonly _hint = 'string'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (this._def.coerce) {
      ctx.setData(String(ctx.data))
    }

    if (!(typeof ctx.data === 'string')) {
      return ctx.INVALID_TYPE({ expected: TParsedType.String }).ABORT()
    }

    for (const rule of this._def.rules) {
      switch (rule.check) {
        case 'min':
          if ((rule.inclusive && ctx.data.length < rule.value) || (!rule.inclusive && ctx.data.length <= rule.value)) {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
          break
        case 'max':
          if ((rule.inclusive && ctx.data.length > rule.value) || (!rule.inclusive && ctx.data.length >= rule.value)) {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
          break
        case 'len':
          if (ctx.data.length !== rule.value) {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
          break
        case 'pattern':
          if (!rule.pattern.test(ctx.data)) {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
          break
        case 'alphanum':
        case 'cuid':
        case 'data_uri':
        case 'email':
        case 'hex':
        case 'iso_date':
        case 'iso_duration':
        case 'uuid':
          if (!utils.Constants.patterns[rule.check].test(ctx.data)) {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
          break
        case 'url':
          try {
            new URL(ctx.data)
          } catch {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
          break
        case 'trim':
          ctx.setData(ctx.data.trim())
          break
        case 'starts_with':
          if (!ctx.data.startsWith(rule.prefix)) {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
          break
        case 'ends_with':
          if (!ctx.data.endsWith(rule.suffix)) {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
          break
        case 'lowercase':
          if (rule.convert) ctx.setData(ctx.data.toLowerCase())
          else if (ctx.data !== ctx.data.toLowerCase()) {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
          break
        case 'uppercase':
          if (rule.convert) ctx.setData(ctx.data.toUpperCase())
          else if (ctx.data !== ctx.data.toUpperCase()) {
            ctx.DIRTY(IssueKind.InvalidString, rule)
            if (ctx.common.abortEarly) return ctx.ABORT()
          }
      }
    }

    return ctx.isValid() ? ctx.OK(ctx.data as this['_O']) : ctx.ABORT()
  }

  /**
   * Enables/disables coercion on the schema. Disabled by default.
   */
  coerce<T extends boolean = true>(value: T = true as T): TString<{ coerce: T; case: S['case'] }> {
    return new TString({ ...this._def, coerce: value })
  }

  /**
   * Specifies the minimum number of characters in the string, where:
   *
   * @param value - The lowest number of characters allowed.
   */
  min<V extends number, I extends boolean = true>(
    value: V,
    options?: { readonly inclusive?: I; readonly message?: string },
    ..._errors: utils.$ValidateNonNegativeInteger<{ 0: V; 1: N.Add<V, 1> }[utils.Equals<I, false>]>
  ): this {
    return this._addRule('min', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeRules(['len'])
  }

  /**
   * Specifies the maximum number of characters in the string, where:
   *
   * @param value - The highest number of characters allowed.
   */
  max<V extends number, I extends boolean = true>(
    value: V,
    options?: { readonly inclusive?: I; readonly message?: string },
    ..._errors: utils.$ValidateNonNegativeInteger<{ 0: V; 1: N.Sub<V, 1> }[utils.Equals<I, false>]>
  ): this {
    return this._addRule('max', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeRules(['len'])
  }

  /**
   * Specifies the exact number of characters in the string, where:
   *
   * @param value - The number of characters allowed.
   */
  length<V extends number>(
    value: V,
    options?: { readonly message?: string },
    ..._errors: utils.$ValidateNonNegativeInteger<V>
  ): this {
    return this._addRule('len', { value, message: options?.message })._removeRules(['min', 'max'])
  }

  /**
   * Specifies that the string must match a regular expression pattern, where:
   *
   * @param pattern - A regular expression object the string value is tested against.
   * @param options.name - Optional name for the pattern (useful with multiple patterns).
   * Defaults to the stringified version of the RegExp.
   */
  pattern(pattern: RegExp, options?: { readonly name?: string; readonly message?: string }): this {
    return this._addRule('pattern', {
      pattern,
      name: options?.name ?? pattern.source,
      message: options?.message,
    })
  }

  /**
   * Requires the value to only contain `a-z`, `A-Z`, and `0-9`.
   */
  alphanumeric(options?: { readonly message?: string }): this {
    return this._addRule('alphanum', { message: options?.message })
  }

  /**
   * @alias {@link alphanumeric | `alphanumeric`}
   */
  alphanum(options?: { readonly message?: string }): this {
    return this.alphanumeric(options)
  }

  /**
   * Requires the value to be a valid email address.
   */
  email(options?: { readonly message?: string }): this {
    return this._addRule('email', { message: options?.message })
  }

  /**
   * Specifies that the string must be a valid URL.
   */
  url(options?: { readonly message?: string }): this {
    return this._addRule('url', { message: options?.message })
  }

  /**
   * Specifies that the string must be a valid UUID.
   */
  uuid(options?: { readonly message?: string }): this {
    return this._addRule('uuid', { message: options?.message })
  }

  /**
   * Specifies that the string must be a valid CUID.
   */
  cuid(options?: { readonly message?: string }): this {
    return this._addRule('cuid', { message: options?.message })
  }

  /**
   * Specifies that the string must be a valid data URI.
   */
  datauri(options?: { readonly message?: string }): this {
    return this._addRule('data_uri', { message: options?.message })
  }

  /**
   * Specifies that the string must be a valid hexadecimal string.
   */
  hex(options?: { readonly message?: string }): this {
    return this._addRule('hex', { message: options?.message })
  }

  /**
   * Specifies that the string must be a valid ISO 8601 duration.
   */
  isoduration(options?: { readonly message?: string }): this {
    return this._addRule('iso_duration', { message: options?.message })
  }

  /**
   * Specifies that the string must be trimmed prior to parsing.
   */
  trim(): this {
    return this._addRule('trim', { message: undefined })
  }

  /**
   * Specifies that the string must start with the given prefix, where:
   *
   * @param prefix - The prefix that the string must start with.
   */
  startsWith(prefix: string, options?: { readonly message?: string }): this {
    return this._addRule('starts_with', { prefix, message: options?.message })
  }

  /**
   * Specifies that the string must end with the given suffix, where:
   *
   * @param suffix - The suffix that the string must end with.
   */
  endsWith(suffix: string, options?: { readonly message?: string }): this {
    return this._addRule('ends_with', { suffix, message: options?.message })
  }

  lowercase<C extends boolean = true>(options?: {
    readonly convert?: C
    readonly message?: string
  }): TString<{ coerce: S['coerce']; case: 'lower' }> {
    return this._addRule('lowercase', {
      convert: options?.convert ?? true,
      message: options?.message,
    })._removeRules(['uppercase']) as TString<{ coerce: S['coerce']; case: 'lower' }>
  }

  uppercase<C extends boolean = true>(options?: {
    readonly convert?: C
    readonly message?: string
  }): TString<{ coerce: S['coerce']; case: 'upper' }> {
    return this._addRule('uppercase', {
      convert: options?.convert ?? true,
      message: options?.message,
    })._removeRules(['lowercase']) as TString<{ coerce: S['coerce']; case: 'upper' }>
  }

  static create = (options?: CreateOptions): TString<{ coerce: false; case: 'none' }> =>
    new TString({ typeName: TTypeName.String, options, rules: [], coerce: false })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                             Number                                             */
/* ---------------------------------------------------------------------------------------------- */

export interface TNumberDef extends TDef {
  readonly typeName: TTypeName.Number
}

export class TNumber extends TType<number, TNumberDef> {
  protected readonly _hint = 'number'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!(typeof ctx.data === 'number')) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Number }).ABORT()
    }

    return ctx.OK(ctx.data)
  }

  static create = (options?: CreateOptions): TNumber => new TNumber({ typeName: TTypeName.Number, options })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                             BigInt                                             */
/* ---------------------------------------------------------------------------------------------- */

export interface TBigIntDef extends TDef {
  readonly typeName: TTypeName.BigInt
}

export class TBigInt extends TType<bigint, TBigIntDef> {
  protected readonly _hint = 'bigint'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return typeof ctx.data === 'bigint' ? ctx.OK(ctx.data) : ctx.INVALID_TYPE({ expected: TParsedType.BigInt }).ABORT()
  }

  static create = (options?: CreateOptions): TBigInt => new TBigInt({ typeName: TTypeName.BigInt, options })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                               NaN                                              */
/* ---------------------------------------------------------------------------------------------- */

export interface TNaNDef extends TDef {
  readonly typeName: TTypeName.NaN
}

export class TNaN extends TType<number, TNaNDef> {
  protected readonly _hint = 'NaN'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return typeof ctx.data === 'number' && Number.isNaN(ctx.data)
      ? ctx.OK(ctx.data)
      : ctx.INVALID_TYPE({ expected: TParsedType.NaN }).ABORT()
  }

  static create = (options?: CreateOptions): TNaN => new TNaN({ typeName: TTypeName.NaN, options })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                             Boolean                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TBooleanState {
  coerce: { true?: readonly utils.Primitive[]; false?: readonly utils.Primitive[] } | boolean
}

export type TBooleanInput<S extends TBooleanState> = S['coerce'] extends false
  ? boolean
  : S['coerce'] extends true
  ? unknown
  : S['coerce'] extends { true?: infer Truthy; false?: infer Falsy }
  ? utils.Defined<Truthy[number & keyof Truthy]> | utils.Defined<Falsy[number & keyof Falsy]>
  : boolean

export interface TBooleanDef extends TDef, TBooleanState {
  readonly typeName: TTypeName.Boolean
}

export class TBoolean<S extends TBooleanState = TBooleanState> extends TType<boolean, TBooleanDef, TBooleanInput<S>> {
  protected readonly _hint = 'boolean'

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
      false: Exclude<S['coerce'], boolean>['false'] extends infer X extends readonly utils.Primitive[]
        ? { 0: X; 1: undefined }[utils.Equals<X, never>]
        : never
    }
  }> {
    return new TBoolean({
      ...this._def,
      coerce: { ...(typeof this._def.coerce === 'boolean' ? {} : this._def.coerce), true: values },
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
      true: Exclude<S['coerce'], boolean>['true'] extends infer X extends readonly utils.Primitive[]
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

/* ---------------------------------------------------------------------------------------------- */
/*                                              True                                              */
/* ---------------------------------------------------------------------------------------------- */

export interface TTrueDef extends TDef {
  readonly typeName: TTypeName.True
}

export class TTrue extends TType<true, TTrueDef> {
  protected readonly _hint = 'true'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === true ? ctx.OK(ctx.data) : ctx.INVALID_TYPE({ expected: TParsedType.True }).ABORT()
  }

  static create = (options?: CreateOptions): TTrue => new TTrue({ typeName: TTypeName.True, options })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                              False                                             */
/* ---------------------------------------------------------------------------------------------- */

export interface TFalseDef extends TDef {
  readonly typeName: TTypeName.False
}

export class TFalse extends TType<false, TFalseDef> {
  protected readonly _hint = 'false'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === false ? ctx.OK(ctx.data) : ctx.INVALID_TYPE({ expected: TParsedType.False }).ABORT()
  }

  static create = (options?: CreateOptions): TFalse => new TFalse({ typeName: TTypeName.False, options })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                              Date                                              */
/* ---------------------------------------------------------------------------------------------- */

export type TDateCheckInputRaw = utils.LiteralUnion<'now', string> | number | Date | Dayjs
export type TDateCheckInput = Date | 'now'

export type TDateCheck = checks.Min<TDateCheckInput> | checks.Max<TDateCheckInput> | checks.Range<TDateCheckInput>

const parseTDateCheckInput = (data: TDateCheckInputRaw): TDateCheckInput =>
  data === 'now' ? 'now' : utils.dayjs(data).toDate()
const toDayjsInput = (data: TDateCheckInput): Dayjs => (data === 'now' ? utils.dayjs() : utils.dayjs(data))

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
  readonly rules: readonly TDateCheck[]
}

export class TDate<S extends TDateState = TDateState> extends TType<Date, TDateDef, TDateInput<S>> {
  protected readonly _hint = 'Date'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const { coerce, rules } = this._def

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

    for (const rule of rules) {
      switch (rule.check) {
        case 'min':
          if (
            rule.inclusive ? data.isBefore(toDayjsInput(rule.value)) : data.isSameOrBefore(toDayjsInput(rule.value))
          ) {
            ctx.DIRTY(IssueKind.InvalidDate, rule)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'max':
          if (rule.inclusive ? data.isAfter(toDayjsInput(rule.value)) : data.isSameOrAfter(toDayjsInput(rule.value))) {
            ctx.DIRTY(IssueKind.InvalidDate, rule)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'range':
          if (
            data.isBetween(
              rule.min,
              rule.max,
              undefined,
              `${['min', 'both'].includes(rule.inclusive) ? '[' : '('}${
                ['max', 'both'].includes(rule.inclusive) ? ']' : ')'
              }`
            )
          ) {
            ctx.DIRTY(IssueKind.InvalidDate, rule)
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
  coerce<T extends boolean | 'strings' | 'numbers' = true>(coercion = true as T): TDate<{ coerce: T }> {
    return new TDate({ ...this._def, coerce: coercion })
  }

  /**
   * Specifies the oldest date allowed, where:
   *
   * @param value - The oldest date allowed.
   * @param options - Options for this rule.
   * @param options.inclusive - Whether the date is inclusive or not.
   * Defaults to `true`.
   * @param options.message - The error message to use.
   */
  min(value: TDateCheckInputRaw, options?: { readonly inclusive?: boolean; readonly message?: string }): TDate<S> {
    return this._addRule('min', {
      value: parseTDateCheckInput(value),
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeRules(['range'])
  }

  /**
   * Shorthand for `min(value, { inclusive: false })`.
   *
   * @see {@link min | `min`}
   */
  after(value: TDateCheckInputRaw, options?: { readonly message?: string }): TDate<S> {
    return this.min(value, { inclusive: false, message: options?.message })
  }

  /**
   * Shorthand for `min(value, { inclusive: true })`.
   *
   * @see {@link min | `min`}
   */
  sameOrAfter(value: TDateCheckInputRaw, options?: { readonly message?: string }): TDate<S> {
    return this.min(value, { inclusive: true, message: options?.message })
  }

  /**
   * Specifies the latest date allowed, where:
   *
   * @param value - The latest date allowed.
   * @param options - Options for this rule.
   * @param options.inclusive - Whether the date is inclusive or not.
   * Defaults to `true`.
   * @param options.message - The error message to use.
   */
  max(value: TDateCheckInputRaw, options?: { readonly inclusive?: boolean; readonly message?: string }): TDate<S> {
    return this._addRule('max', {
      value: parseTDateCheckInput(value),
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeRules(['range'])
  }

  /**
   * Shorthand for `max(value, { inclusive: false })`.
   *
   * @see {@link max | `max`}
   */
  before(value: TDateCheckInputRaw, options?: { readonly message?: string }): TDate<S> {
    return this.max(value, { inclusive: false, message: options?.message })
  }

  /**
   * Shorthand for `max(value, { inclusive: true })`.
   *
   * @see {@link max | `max`}
   */
  sameOrBefore(value: TDateCheckInputRaw, options?: { readonly message?: string }): TDate<S> {
    return this.max(value, { inclusive: true, message: options?.message })
  }

  /**
   * Specifies a range of dates, where:
   *
   * @param min - The oldest date allowed.
   * @param max - The latest date allowed.
   * @param options - Options for this rule.
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
    return this._addRule('range', {
      min: parseTDateCheckInput(min),
      max: parseTDateCheckInput(max),
      inclusive: options?.inclusive ?? 'both',
      message: options?.message,
    })._removeRules(['min', 'max'])
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
    new TDate({ typeName: TTypeName.Date, options, rules: [], coerce: false })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                             Symbol                                             */
/* ---------------------------------------------------------------------------------------------- */

export interface TSymbolDef extends TDef {
  readonly typeName: TTypeName.Symbol
}

export class TSymbol extends TType<symbol, TSymbolDef> {
  protected readonly _hint = 'symbol'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return typeof ctx.data === 'symbol' ? ctx.OK(ctx.data) : ctx.INVALID_TYPE({ expected: TParsedType.Symbol }).ABORT()
  }

  static create = (options?: CreateOptions): TSymbol => new TSymbol({ typeName: TTypeName.Symbol, options })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                              Null                                              */
/* ---------------------------------------------------------------------------------------------- */

export interface TNullDef extends TDef {
  readonly typeName: TTypeName.Null
}

export class TNull extends TType<null, TNullDef> {
  protected readonly _hint = 'null'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === null ? ctx.OK(ctx.data) : ctx.INVALID_TYPE({ expected: TParsedType.Null }).ABORT()
  }

  static create = (options?: CreateOptions): TNull =>
    new TNull({ typeName: TTypeName.Null, options, meta: { nullable: true } })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                            Undefined                                           */
/* ---------------------------------------------------------------------------------------------- */

export interface TUndefinedDef extends TDef {
  readonly typeName: TTypeName.Undefined
}

export class TUndefined extends TType<undefined, TUndefinedDef> {
  protected readonly _hint = 'undefined'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === undefined ? ctx.OK(ctx.data) : ctx.INVALID_TYPE({ expected: TParsedType.Undefined }).ABORT()
  }

  static create = (options?: CreateOptions): TUndefined =>
    new TUndefined({ typeName: TTypeName.Undefined, options, meta: { required: false } })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                              Void                                              */
/* ---------------------------------------------------------------------------------------------- */

export interface TVoidDef extends TDef {
  readonly typeName: TTypeName.Void
}

export class TVoid extends TType<void, TVoidDef> {
  protected readonly _hint = 'void'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === undefined ? ctx.OK(ctx.data) : ctx.INVALID_TYPE({ expected: TParsedType.Void }).ABORT()
  }

  static create = (options?: CreateOptions): TVoid =>
    new TVoid({ typeName: TTypeName.Void, options, meta: { required: false } })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                              Never                                             */
/* ---------------------------------------------------------------------------------------------- */

export interface TNeverDef extends TDef<never> {
  readonly typeName: TTypeName.Never
}

export class TNever extends TType<never, TNeverDef> {
  protected readonly _hint = 'never'

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.FORBIDDEN().ABORT()
  }

  static create = (options?: CreateOptions): TNever => new TNever({ typeName: TTypeName.Never, options })
}

/* ---------------------------------------------------------------------------------------------- */
/*                                             Literal                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TLiteralDef<V extends utils.Primitive> extends TDef {
  readonly typeName: TTypeName.Literal
  readonly value: V
}

export class TLiteral<V extends utils.Primitive> extends TType<V, TLiteralDef<V>> {
  protected readonly _hint = utils.literalize(this._def.value)

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!utils.isPrimitive(ctx.data)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Primitive }).ABORT()
    }

    if (ctx.data !== this.value) {
      return ctx.INVALID_LITERAL({ expected: this.value, received: ctx.data }).ABORT()
    }

    return ctx.OK(ctx.data as V)
  }

  get value(): V {
    return this._def.value
  }

  static create = <V extends utils.Primitive>(value: V, options?: CreateOptions): TLiteral<V> =>
    new TLiteral({
      typeName: TTypeName.Literal,
      options,
      value,
      meta: { required: value !== undefined, nullable: value === null },
    })
}

export type AnyTLiteral = TLiteral<utils.Primitive>

/* ---------------------------------------------------------------------------------------------- */
/*                                              Enum                                              */
/* ---------------------------------------------------------------------------------------------- */

export type EnumValue = string | number
export type EnumValues<T extends EnumValue = EnumValue> = readonly [T, ...T[]]

export type EnumLike = { [x: string]: EnumValue } & { [x: number]: string }

export type UnionToEnumValues<T> = utils.UnionToTuple<T> extends infer X extends EnumValues ? X : never

export type ToEnumPrimitive<T extends EnumValue> = `${T}` extends `${infer N extends number}` ? N : `${T}`

export type ToEnumLike<T> = utils.Simplify<utils.OmitIndexSignature<T>> extends infer X
  ? X extends EnumLike
    ? { [K in keyof X]: ToEnumPrimitive<X[K]> }
    : never
  : never

export type EnumExtract<T extends EnumLike, V extends T[keyof T]> = ToEnumLike<{
  [K in keyof T as ToEnumPrimitive<T[K]> extends ToEnumPrimitive<V> ? K : never]: T[K]
}>
export type EnumExclude<T extends EnumLike, V extends T[keyof T]> = ToEnumLike<{
  [K in keyof T as ToEnumPrimitive<T[K]> extends ToEnumPrimitive<V> ? never : K]: T[K]
}>

export interface TEnumDef<T extends EnumLike> extends TDef {
  readonly typeName: TTypeName.Enum
  readonly enum: T
}

export class TEnum<T extends EnumLike> extends TType<T[keyof T], TEnumDef<T>> {
  protected readonly _hint = this.values.map(utils.literalize).join(' | ')

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const enumTypes = [
      ...new Set(
        this.values
          .map((value) => typeof value)
          .filter((type): type is 'string' | 'number' => utils.includes(['string', 'number'], type))
      ),
    ]

    const isValidEnumType = (data: unknown): data is EnumValue => utils.includes(enumTypes, typeof data)

    if (!isValidEnumType(ctx.data)) {
      return ctx
        .INVALID_TYPE({
          expected:
            enumTypes.length === 1
              ? { string: TParsedType.String, number: TParsedType.Number }[enumTypes[0]]
              : TParsedType.EnumValue,
        })
        .ABORT()
    }

    if (!utils.includes(this.values, ctx.data)) {
      return ctx.INVALID_ENUM_VALUE({ expected: this.values, received: ctx.data }).ABORT()
    }

    return ctx.OK(ctx.data as T[keyof T])
  }

  get enum(): T {
    return this._def.enum
  }

  get values(): UnionToEnumValues<T[keyof T]> {
    return Object.values(this.enum) as unknown as UnionToEnumValues<T[keyof T]>
  }

  extract<V extends T[keyof T]>(...values: readonly [V, ...V[]]): TEnum<EnumExtract<T, V>>
  extract<V extends T[keyof T]>(values: readonly [V, ...V[]]): TEnum<EnumExtract<T, V>>
  extract<V extends T[keyof T]>(...values: readonly [V, ...V[]]) {
    const valuesArr = Array.isArray(values[0]) ? values[0] : values
    return new TEnum({
      ...this._def,
      typeName: TTypeName.Enum,
      enum: Object.fromEntries(
        Object.entries(this.enum).filter(([_, v]) => utils.includes(valuesArr, v))
      ) as EnumExtract<T, V>,
    })
  }

  exclude<V extends T[keyof T]>(...values: readonly [V, ...V[]]): TEnum<EnumExclude<T, V>>
  exclude<V extends T[keyof T]>(values: readonly [V, ...V[]]): TEnum<EnumExclude<T, V>>
  exclude<V extends T[keyof T]>(...values: readonly [V, ...V[]]) {
    const valuesArr = Array.isArray(values[0]) ? values[0] : values
    return new TEnum({
      ...this._def,
      typeName: TTypeName.Enum,
      enum: Object.fromEntries(
        Object.entries(this.enum).filter(([_, v]) => !utils.includes(valuesArr, v))
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
  private static _create(valuesOrEnum: EnumValues | EnumLike, options?: CreateOptions) {
    const getValidEnumObject = <T extends EnumLike>(obj: T): { [x: string]: EnumValue } =>
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

/* ---------------------------------------------------------------------------------------------- */
/*                                           InstanceOf                                           */
/* ---------------------------------------------------------------------------------------------- */

export interface TInstanceOfDef<T extends utils.Class> extends TDef {
  readonly typeName: TTypeName.InstanceOf
  readonly cls: T
}

export class TInstanceOf<T extends utils.Class> extends TType<InstanceType<T>, TInstanceOfDef<T>> {
  protected readonly _hint = `InstanceOf<${this.cls.name}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data instanceof this.cls ? ctx.OK(ctx.data) : ctx.INVALID_INSTANCE({ expected: this.cls.name }).ABORT()
  }

  get cls(): T {
    return this._def.cls
  }

  static create = <T extends utils.Class>(cls: T, options?: CreateOptions): TInstanceOf<T> =>
    new TInstanceOf({ typeName: TTypeName.InstanceOf, options, cls })
}

export type AnyTInstanceOf = TInstanceOf<utils.Class>

/* ---------------------------------------------------------------------------------------------- */
/*                                            Nullable                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TNullableDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Nullable
  readonly underlying: T
}

export type UnwrapTNullableDeep<T> = T extends TNullable<infer U> ? UnwrapTNullableDeep<U> : T

export class TNullable<T extends AnyTType> extends TType<T['_O'] | null, TNullableDef<T>, T['_I'] | null> {
  get _hint() {
    const needsParens = this.underlying.isType(TTypeName.Function)
    return `${needsParens ? '(' : ''}${this.underlying['_hint']}${needsParens ? ')' : ''} | null`
  }

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === null ? ctx.OK(ctx.data) : this.underlying._parse(ctx.clone({ type: this.underlying }))
  }

  get underlying(): T {
    return this._def.underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): UnwrapTNullableDeep<T> {
    return this.underlying instanceof TNullable ? this.underlying.unwrapDeep() : this.underlying
  }

  static create = <T extends AnyTType>(underlying: T, options?: CreateOptions): TNullable<T> =>
    new TNullable({ typeName: TTypeName.Nullable, options, underlying, meta: { ...underlying.meta, nullable: true } })
}

export type AnyTNullable = TNullable<AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                            Optional                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TOptionalDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Optional
  readonly underlying: T
}

export type UnwrapTOptionalDeep<T> = T extends TOptional<infer U> ? UnwrapTOptionalDeep<U> : T

export class TOptional<T extends AnyTType> extends TType<T['_O'] | undefined, TOptionalDef<T>, T['_I'] | undefined> {
  get _hint() {
    const needsParens = this.underlying.isType(TTypeName.Function)
    return `${needsParens ? '(' : ''}${this.underlying['_hint']}${needsParens ? ')' : ''} | undefined`
  }

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return ctx.data === undefined ? ctx.OK(ctx.data) : this.underlying._parse(ctx.clone({ type: this.underlying }))
  }

  get underlying(): T {
    return this._def.underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): UnwrapTOptionalDeep<T> {
    return this.underlying instanceof TOptional ? this.underlying.unwrapDeep() : this.underlying
  }

  static create = <T extends AnyTType>(underlying: T, options?: CreateOptions): TOptional<T> =>
    new TOptional({ typeName: TTypeName.Optional, options, underlying, meta: { ...underlying.meta, required: false } })
}

export type AnyTOptional = TOptional<AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                            Required                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TRequiredDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Required
  readonly underlying: T
}

export type UnwrapTRequiredDeep<T> = T extends TRequired<infer U> ? UnwrapTRequiredDeep<U> : T

export class TRequired<T extends AnyTType> extends TType<
  utils.Defined<T['_O']>,
  TRequiredDef<T>,
  utils.Defined<T['_I']>
> {
  protected readonly _hint = `Required<${this.underlying['_hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (ctx.data === undefined) {
      return ctx.REQUIRED().ABORT()
    }
    return this.underlying._parse(ctx.clone({ type: this.underlying })) as ParseResultOf<this>
  }

  get underlying(): T {
    return this._def.underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): UnwrapTRequiredDeep<T> {
    return this.underlying instanceof TRequired ? this.underlying.unwrapDeep() : this.underlying
  }

  static create = <T extends AnyTType>(underlying: T, options?: CreateOptions): TRequired<T> => {
    return new TRequired({
      typeName: TTypeName.Required,
      options,
      underlying,
      meta: { ...underlying.meta, required: true },
    })
  }
}

export type AnyTRequired = TRequired<AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                              Lazy                                              */
/* ---------------------------------------------------------------------------------------------- */

export interface TLazyDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Lazy
  readonly getType: () => T
}

export type UnwrapTLazyDeep<T> = T extends TLazy<infer U> ? UnwrapTLazyDeep<U> : T

export class TLazy<T extends AnyTType> extends TType<T['_O'], TLazyDef<T>, T['_I']> {
  get _hint() {
    return this.underlying['_hint']
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
    return this.underlying instanceof TLazy ? this.underlying.unwrapDeep() : this.underlying
  }

  static create = <T extends AnyTType>(factory: () => T, options?: CreateOptions): TLazy<T> =>
    new TLazy({
      typeName: TTypeName.Lazy,
      options,
      getType: factory,
      get meta() {
        return factory().meta
      },
    })
}

export type AnyTLazy = TLazy<AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                             Promise                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TPromiseDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Promise
  readonly awaited: T
}

export type UnwrapTPromiseDeep<T> = T extends TPromise<infer U> ? UnwrapTPromiseDeep<U> : T

export class TPromise<T extends AnyTType> extends TType<Promise<T['_O']>, TPromiseDef<T>, Promise<T['_I']>> {
  protected readonly _hint = `Promise<${this.awaited['_hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!(ctx.data instanceof Promise) && ctx.common.async === false) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Promise }).ABORT()
    }
    return ctx.OK(
      (ctx.data instanceof Promise ? ctx.data : Promise.resolve(ctx.data)).then((data) => this.awaited.parseAsync(data))
    )
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
    return this.awaited instanceof TPromise ? this.awaited.unwrapDeep() : this.awaited
  }

  static create = <T extends AnyTType>(awaited: T, options?: CreateOptions): TPromise<T> =>
    new TPromise({ typeName: TTypeName.Promise, options, awaited, meta: awaited.meta })
}

export type AnyTPromise = TPromise<AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                             Branded                                            */
/* ---------------------------------------------------------------------------------------------- */

export const BRAND = Symbol('TBrand')
export type BRAND = typeof BRAND
export type Brand<B extends PropertyKey> = {
  readonly [BRAND]: { readonly [K in B]: true }
}

export interface TBrandedDef<T extends AnyTType, B extends PropertyKey> extends TDef {
  readonly typeName: TTypeName.Branded
  readonly type: T
  readonly brand: B
}

export class TBranded<T extends AnyTType, B extends PropertyKey> extends TType<
  T['_O'] & Brand<B>,
  TBrandedDef<T, B>,
  T['_I']
> {
  protected readonly _hint = `Branded<${this.underlying['_hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    return this.underlying._parse(ctx.clone({ type: this.underlying })) as ParseResultOf<this>
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
  ): TBranded<T, B> => new TBranded({ typeName: TTypeName.Branded, options, type, brand, meta: type.meta })
}

export type AnyTBranded = TBranded<AnyTType, PropertyKey>

/* ---------------------------------------------------------------------------------------------- */
/*                                             Default                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TDefaultDef<T extends AnyTType, D extends utils.Defined<T['_I']>> extends TDef {
  readonly typeName: TTypeName.Default
  readonly type: T
  readonly getDefaultValue: () => D
}

export class TDefault<T extends AnyTType, D extends utils.Defined<T['_I']>> extends TType<
  utils.Defined<T['_O']>,
  TDefaultDef<T, D>,
  T['_I'] | undefined
> {
  protected readonly _hint = `Default<${this.underlying['_hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (ctx.data === undefined) {
      ctx.setData(this.getDefault())
    }
    return this.underlying._parse(ctx.clone({ type: this.underlying })) as ParseResultOf<this>
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
      getDefaultValue: (typeof defaultValue === 'function' ? defaultValue : () => defaultValue) as () => D,
      meta: type.meta,
    })
}

export type AnyTDefault = TDefault<AnyTType, unknown>

/* ---------------------------------------------------------------------------------------------- */
/*                                              Catch                                             */
/* ---------------------------------------------------------------------------------------------- */

export interface TCatchDef<T extends AnyTType, C extends T['_I']> extends TDef {
  readonly typeName: TTypeName.Catch
  readonly type: T
  readonly getCatchValue: () => C
}

export class TCatch<T extends AnyTType, C extends T['_I']> extends TType<T['_O'] | C, TCatchDef<T, C>, T['_I']> {
  protected readonly _hint = `Catch<${this.underlying['_hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const result = this.underlying._parse(ctx.clone({ type: this.underlying }))

    if (result instanceof Promise) {
      return result.then((awaitedRes) => ctx.OK(awaitedRes.ok ? awaitedRes.data : this.getCatch()))
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
      getCatchValue: (typeof catchValue === 'function' ? catchValue : () => catchValue) as () => C,
      meta: type.meta,
    })
}

export type AnyTCatch = TCatch<AnyTType, unknown>

/* ---------------------------------------------------------------------------------------------- */
/*                                              Array                                             */
/* ---------------------------------------------------------------------------------------------- */

export type TArrayCheck = checks.Min | checks.Max | checks.Length | checks.SortAscending | checks.SortDescending

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
      ...utils.PartialTuple<utils.ConstructTuple<T[IO], N.Sub<S['max'], S['min']>>>,
      ...never[]
    ]

export interface TArrayDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Array
  readonly rules: readonly TArrayCheck[]
  readonly element: T
}

export class TArray<T extends AnyTType, S extends TArrayState = TArrayInitialState> extends TType<
  TArrayIO<T, S, '_O'>,
  TArrayDef<T>,
  TArrayIO<T, S, '_I'>
> {
  get _hint() {
    const needsParens = this.element.isType(
      TTypeName.Tuple,
      TTypeName.Enum,
      TTypeName.Union,
      TTypeName.Optional,
      TTypeName.Nullable
    )
    return `${needsParens ? '(' : ''}${this.element['_hint']}${needsParens ? ')' : ''}[]`
  }

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!Array.isArray(ctx.data)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Array }).ABORT()
    }

    for (const rule of this._def.rules) {
      switch (rule.check) {
        case 'min':
          if ((rule.inclusive && ctx.data.length < rule.value) || (!rule.inclusive && ctx.data.length <= rule.value)) {
            ctx.DIRTY(IssueKind.InvalidArray, rule)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'max':
          if ((rule.inclusive && ctx.data.length > rule.value) || (!rule.inclusive && ctx.data.length >= rule.value)) {
            ctx.DIRTY(IssueKind.InvalidArray, rule)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'len':
          if (ctx.data.length !== rule.value) {
            ctx.DIRTY(IssueKind.InvalidArray, rule)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'sort_ascending':
          const sortedAsc = [...ctx.data].sort()
          if (rule.convert) {
            ctx.setData(sortedAsc)
          } else if (ctx.data.some((item, idx) => sortedAsc[idx] !== item)) {
            ctx.DIRTY(IssueKind.InvalidArray, rule)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'sort_descending':
          const sortedDesc = [...ctx.data].sort().reverse()
          if (rule.convert) {
            ctx.setData(sortedDesc)
          } else if (ctx.data.some((item, idx) => sortedDesc[idx] !== item)) {
            ctx.DIRTY(IssueKind.InvalidArray, rule)
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
              return parseResult as FailedParseResultOf<this>
            }
          }
        }
        return ctx.isValid() ? ctx.OK(result as this['_O']) : ctx.ABORT()
      })
    } else {
      for (const [index, value] of entries) {
        const parseResult = this.element._parseSync(ctx.child({ type: this.element, data: value, path: [index] }))
        if (parseResult.ok) {
          result.push(parseResult.data)
        } else {
          if (ctx.common.abortEarly) {
            return parseResult as FailedParseResultOf<this>
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
    return this._addRule('min', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeRules(['len']) as unknown as TArray<T, ComputeNextTArrayState<S, 'min', V, I>>
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
    return this._addRule('max', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeRules(['len']) as unknown as TArray<T, ComputeNextTArrayState<S, 'max', V, I>>
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
    return this._addRule('len', {
      value,
      message: options?.message,
    })._removeRules(['min', 'max']) as unknown as TArray<T, { min: V; max: V }>
  }

  /**
   * Requires the array to comply with the `ascending` sort order.
   *
   * @param options - Options for this rule.
   * @param options.convert - When `true`, the array is modified to match the sort order.
   * Defaults to `false`.
   * @param options.message - The error message to use.
   */
  ascending(options?: { readonly convert?: boolean; readonly message?: string }): this {
    return this._addRule('sort_ascending', {
      direction: 'ascending',
      convert: options?.convert ?? false,
      message: options?.message,
    })._removeRules(['sort_descending'])
  }

  /**
   * Requires the array to comply with the `descending` sort order.
   *
   * @param options - Options for this rule.
   * @param options.convert - When `true`, the array is modified to match the sort order.
   * Defaults to `false`.
   * @param options.message - The error message to use.
   */
  descending(options?: { readonly convert?: boolean; readonly message?: string }): this {
    return this._addRule('sort_descending', {
      direction: 'descending',
      convert: options?.convert ?? false,
      message: options?.message,
    })._removeRules(['sort_ascending'])
  }

  /**
   * Flattens this `TArray` one level deep (if applicable).
   */
  flatten(): T extends AnyTArray ? T : this {
    return (this.element instanceof TArray ? this.element : this) as T extends AnyTArray ? T : this
  }

  static create = <T extends AnyTType>(element: T, options?: CreateOptions): TArray<T> =>
    new TArray({ typeName: TTypeName.Array, options, rules: [], element })
}

export type AnyTArray = TArray<AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                              TSet                                              */
/* ---------------------------------------------------------------------------------------------- */

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
  readonly rules: readonly TSetCheck[]
  readonly element: T
}

export class TSet<T extends AnyTType, S extends TSetState = TSetInitialState> extends TType<
  Set<T['_O']>,
  TSetDef<T>,
  Set<T['_I']>
> {
  protected readonly _hint = `Set<${this.element['_hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!(ctx.data instanceof Set)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Set }).ABORT()
    }

    for (const rule of this._def.rules) {
      switch (rule.check) {
        case 'min':
          if ((rule.inclusive && ctx.data.size < rule.value) || (!rule.inclusive && ctx.data.size <= rule.value)) {
            ctx.DIRTY(IssueKind.InvalidSet, rule)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'max':
          if ((rule.inclusive && ctx.data.size > rule.value) || (!rule.inclusive && ctx.data.size >= rule.value)) {
            ctx.DIRTY(IssueKind.InvalidSet, rule)
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
          break
        case 'size':
          if (ctx.data.size !== rule.value) {
            ctx.DIRTY(IssueKind.InvalidSet, rule)
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
          const valResult = await element._parseAsync(ctx.child({ type: element, data: val, path: [idx] }))
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
        const valResult = element._parseSync(ctx.child({ type: element, data: val, path: [idx] }))
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
    return this._addRule('min', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeRules(['size']) as unknown as TSet<T, ComputeNextTSetState<S, 'min', V, I>>
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
    return this._addRule('max', {
      value,
      inclusive: options?.inclusive ?? true,
      message: options?.message,
    })._removeRules(['size']) as unknown as TSet<T, ComputeNextTSetState<S, 'max', V, I>>
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
    return this._addRule('size', {
      value,
      message: options?.message,
    })._removeRules(['min', 'max']) as unknown as TSet<T, { min: V; max: V }>
  }

  static create = <T extends AnyTType>(element: T, options?: CreateOptions) =>
    new TSet({ typeName: TTypeName.Set, options, element, rules: [] })
}

export type AnyTSet = TSet<AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                             TTuple                                             */
/* ---------------------------------------------------------------------------------------------- */

export type TTupleItems = readonly [AnyTType, ...AnyTType[]] | readonly []
export type TTupleRest = AnyTType

export type CastToTTupleItems<T> = T extends TTupleItems ? T : never

export type TTupleCheck = checks.Min | checks.Max

export type TTupleIO<T extends TTupleItems, R extends TTupleRest | null, IO extends '_I' | '_O'> = (
  T extends readonly []
    ? R extends TTupleRest
      ? [...R[IO][]]
      : T
    : T extends readonly [infer H extends AnyTType, ...infer R_]
    ? readonly [
        H[IO],
        ...utils.CastToArray<
          R_ extends readonly []
            ? R extends TTupleRest
              ? R[IO][]
              : []
            : R_ extends readonly [AnyTType]
            ? readonly [R_[0][IO], ...(R extends TTupleRest ? R[IO][] : [])]
            : R_ extends TTupleItems
            ? TTupleIO<R_, R, IO>
            : never
        >
      ]
    : never
) extends infer X
  ? Readonly<utils.EnforcePartialTuple<X>>
  : never

export interface TTupleDef<T extends TTupleItems, R extends TTupleRest | null> extends TDef {
  readonly typeName: TTypeName.Tuple
  readonly rules: readonly TTupleCheck[]
  readonly items: T
  readonly rest: R
}

export class TTuple<T extends TTupleItems, R extends TTupleRest | null> extends TType<
  TTupleIO<T, R, '_O'>,
  TTupleDef<T, R>,
  TTupleIO<T, R, '_I'>
> {
  protected readonly _hint = `readonly [${this.items
    .map((i) => (i.isOptional() ? `(${i['_hint']})?` : i['_hint']))
    .join(', ')}${this.restType ? `${this.items.length > 0 ? ', ' : ''}...${this.restType.array()['_hint']}` : ''}]`

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
          check: 'min',
          value: items.length,
          inclusive: true,
          message: undefined,
        })
        .ABORT()
    }

    if (!rest && data.length > items.length) {
      return ctx
        .DIRTY(IssueKind.InvalidTuple, {
          check: 'max',
          value: items.length,
          inclusive: true,
          message: undefined,
        })
        .ABORT()
    }

    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        for (const [val, idx] of data) {
          const valParser = items[idx] ?? rest
          const valResult = await valParser._parseAsync(ctx.child({ type: valParser, data: val, path: [idx] }))
          if (valResult.ok) {
            result.push(valResult.data)
          } else if (ctx.common.abortEarly) {
            return ctx.ABORT()
          }
        }
        return ctx.isValid() ? ctx.OK(result as unknown as this['_O']) : ctx.ABORT()
      })
    } else {
      for (const [val, idx] of data) {
        const valParser = items[idx] ?? rest
        const valResult = valParser._parseSync(ctx.child({ type: valParser, data: val, path: [idx] }))
        if (valResult.ok) {
          result.push(valResult.data)
        } else if (ctx.common.abortEarly) {
          return ctx.ABORT()
        }
      }
      return ctx.isValid() ? ctx.OK(result as unknown as this['_O']) : ctx.ABORT()
    }
  }

  get items(): T {
    return this._def.items
  }

  get restType(): R {
    return this._def.rest
  }

  push<T_ extends [AnyTType, ...AnyTType[]]>(
    ...items: T_
  ): TTuple<T extends readonly [] ? T_ : readonly [...T, ...T_], R>
  push<T_ extends [AnyTType, ...AnyTType[]]>(items: T_): TTuple<T extends readonly [] ? T_ : readonly [...T, ...T_], R>
  push<T_ extends [AnyTType, ...AnyTType[]]>(...items: T_) {
    return new TTuple({
      ...this._def,
      items: this.items[0]
        ? [this.items[0], ...utils.tail(this.items), ...(utils.isArray(items[0]) ? items[0] : items)]
        : utils.isArray(items[0])
        ? items[0]
        : items,
    })
  }

  append<T_ extends [AnyTType, ...AnyTType[]]>(
    ...items: T_
  ): TTuple<T extends readonly [] ? T_ : readonly [...T, ...T_], R>
  append<T_ extends [AnyTType, ...AnyTType[]]>(
    items: T_
  ): TTuple<T extends readonly [] ? T_ : readonly [...T, ...T_], R>
  append<T_ extends [AnyTType, ...AnyTType[]]>(...items: T_) {
    return this.push(items)
  }

  rest<R_ extends TTupleRest>(rest: R_): TTuple<T, R_> {
    return new TTuple({ ...this._def, rest })
  }

  removeRest(): TTuple<T, null> {
    return new TTuple({ ...this._def, rest: null })
  }

  partial(): TTuple<SetPartialArr<T>, R> {
    return new TTuple({
      ...this._def,
      items: this.items.map((i) => (i instanceof TOptional ? i : i.optional())) as SetPartialArr<T>,
    })
  }

  private static _create<T extends TTupleItems>(items: T, options?: CreateOptions): TTuple<T, null>
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
      rules: [],
    })
  }

  static create = this._create
}

export type AnyTTuple = TTuple<TTupleItems, TTupleRest | null>

/* ---------------------------------------------------------------------------------------------- */
/*                                             Record                                             */
/* ---------------------------------------------------------------------------------------------- */

export type TRecordIO<K extends AnyTType<PropertyKey>, V extends AnyTType, IO extends '_I' | '_O'> = utils.Simplify<
  utils.EnforceOptional<Record<K[IO], V[IO]>>
>

export interface TRecordDef<K extends AnyTType<PropertyKey>, V extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Record
  readonly keys: K
  readonly values: V
}

export class TRecord<K extends AnyTType<PropertyKey>, V extends AnyTType> extends TType<
  TRecordIO<K, V, '_O'>,
  TRecordDef<K, V>,
  TRecordIO<K, V, '_I'>
> {
  protected readonly _hint = `Record<${this.keys['_hint']}, ${this.values['_hint']}>`

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!utils.isObject(ctx.data)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Object }).ABORT()
    }

    const { keys, values } = this._def
    const data = Reflect.ownKeys(ctx.data).map(
      (k) => [typeof k === 'symbol' || Number.isNaN(+k) ? k : +k, (ctx.data as Record<typeof k, unknown>)[k]] as const
    )
    const result = {} as Record<K['_O'], V['_O']>

    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        for (const [key, val] of data) {
          const keyResult = await keys._parseAsync(
            ctx.child({
              type: keys,
              data: key,
              path: [typeof key === 'symbol' ? String(key) : key],
            })
          )
          const valResult = await values._parseAsync(
            ctx.child({
              type: values,
              data: val,
              path: [typeof key === 'symbol' ? String(key) : key],
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
        const keyResult = keys._parseSync(
          ctx.child({
            type: keys,
            data: key,
            path: [typeof key === 'symbol' ? String(key) : key],
          })
        )
        const valResult = values._parseSync(
          ctx.child({
            type: values,
            data: val,
            path: [typeof key === 'symbol' ? String(key) : key],
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

  get entries(): readonly [keys: K, values: V] {
    return [this.keys, this.values]
  }

  partial(): TRecord<K, TOptional<V>> {
    return new TRecord({ ...this._def, values: this.values.optional() })
  }

  private static _create<V extends AnyTType>(values: V, options?: CreateOptions): TRecord<TString, V>
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

/* ---------------------------------------------------------------------------------------------- */
/*                                              TMap                                              */
/* ---------------------------------------------------------------------------------------------- */

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
  protected readonly _hint = `Map<${this.keys['_hint']}, ${this.values['_hint']}>`

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
          const keyResult = await keys._parseAsync(ctx.child({ type: keys, data: key, path: [idx, 'key'] }))
          const valResult = await values._parseAsync(ctx.child({ type: values, data: val, path: [idx, 'value'] }))
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
        const keyResult = keys._parseSync(ctx.child({ type: keys, data: key, path: [idx, 'key'] }))
        const valResult = values._parseSync(ctx.child({ type: values, data: val, path: [idx, 'value'] }))
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

  get entries(): readonly [keys: K, values: V] {
    return [this.keys, this.values]
  }

  static create = <K extends AnyTType, V extends AnyTType>(keys: K, values: V, options?: CreateOptions): TMap<K, V> =>
    new TMap({ typeName: TTypeName.Map, options, keys, values })
}

export type AnyTMap = TMap<AnyTType, AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                             Object                                             */
/* ---------------------------------------------------------------------------------------------- */

export type TObjectShape = { [x: string]: AnyTType }
export type TObjectUnknownKeys = 'passthrough' | 'strip' | 'strict'
export type TObjectCatchall = AnyTType

export type TObjectIO<
  S extends TObjectShape,
  UK extends TObjectUnknownKeys | null,
  C extends TObjectCatchall | null,
  IO extends '_I' | '_O'
> = utils.Simplify<utils.EnforceOptional<{ [K in keyof S]: S[K][IO] }>> extends infer X
  ? { [K in keyof X]: X[K] } & (C extends TObjectCatchall
      ? { [x: string]: C[IO] }
      : UK extends 'passthrough'
      ? { [x: string]: unknown }
      : UK extends 'strict'
      ? { [x: string]: never }
      : unknown)
  : never

export type PartialDeep<T extends AnyTType> = T extends TObject<infer S, infer UK, infer C>
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
        Object.entries(type.shape).map(([k, v]) => [k, TOptional.create(makePartialDeep(v as AnyTType))])
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

export type MergeTObjectsDeep<A, B> = [A, B] extends [
  AnyTObject<infer ShapeA>,
  TObject<infer ShapeB, infer UnknownKeysB, infer CatchallB>
]
  ? TObject<
      {
        [K in keyof ShapeA | keyof ShapeB]: K extends keyof ShapeB
          ? K extends keyof ShapeA
            ? [ShapeA[K], ShapeB[K]] extends [
                TObject<infer ShapeC, infer UnknownKeysC, infer CatchallC>,
                TObject<infer ShapeD, infer UnknownKeysD, infer CatchallD>
              ]
              ? MergeTObjectsDeep<TObject<ShapeC, UnknownKeysC, CatchallC>, TObject<ShapeD, UnknownKeysD, CatchallD>>
              : ShapeB[K]
            : ShapeB[K]
          : ShapeA[K & keyof ShapeA]
      },
      UnknownKeysB,
      CatchallB
    >
  : never

type _DeepKeysTuple<T> = T extends readonly []
  ? never
  : T extends readonly [infer H, ...infer R]
  ? H | (R extends [infer I] ? I : _DeepKeysTuple<R>)
  : never
type DeepKeysTuple<T> = _DeepKeysTuple<{ [K in keyof T]: K }>
export type DeepKeys<S extends TObjectShape> = {
  [K in keyof S]:
    | K
    | (S[K] extends AnyTObject<infer S_>
        ? `${K & string}.${DeepKeys<S_> & string}`
        : S[K] extends TTuple<infer I extends TTupleItems, TTupleRest | null>
        ? `${K & string}[${DeepKeysTuple<I> & string}]`
        : never)
}[keyof S]

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
  U extends TObjectUnknownKeys | null,
  C extends TObjectCatchall | null
> extends TType<TObjectIO<S, U, C, '_O'>, TObjectDef<S, U, C>, TObjectIO<S, U, C, '_I'>> {
  get _hint() {
    const needsParens = this._def.catchall || utils.includes(['passthrough', 'strict'], this._def.unknownKeys)

    const hint = `{ ${Object.entries(this.shape)
      .map(([k, v]) => `${k}${v.isOptional() ? '?' : ''}: ${v['_hint']}`)
      .join(', ')} }${
      this._def.catchall || utils.includes(['passthrough', 'strict'], this._def.unknownKeys)
        ? ` & { [x: string]: ${
            this._def.catchall?.['_hint'] ?? (this._def.unknownKeys === 'passthrough' ? 'unknown' : 'never')
          } }`
        : ''
    }`

    return needsParens ? `(${hint})` : hint
  }

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    if (!utils.isObject(ctx.data)) {
      return ctx.INVALID_TYPE({ expected: TParsedType.Object }).ABORT()
    }

    const { shape, unknownKeys, catchall } = this._def
    const shapeKeys = Object.keys(shape)
    const extraKeys = new Set<string>()
    const data = ctx.data

    if (unknownKeys !== 'strip' || !catchall || catchall instanceof TNever) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.add(key)
        }
      }
    }

    const parsePairs = new Map<string, { parseSync: () => SyncParseResult; parseAsync: () => AsyncParseResult }>()
    for (const key of shapeKeys) {
      const keyParser = shape[key]
      const value = data[key]
      const childCtx = ctx.child({ type: keyParser, data: value, path: [key] })
      parsePairs.set(key, {
        parseSync: () => keyParser._parseSync(childCtx),
        parseAsync: () => keyParser._parseAsync(childCtx),
      })
    }

    if (!catchall || catchall instanceof TNever) {
      if (unknownKeys === 'passthrough') {
        for (const key of extraKeys) {
          parsePairs.set(key, {
            parseSync: () => ({ ok: true, data: data[key] }),
            parseAsync: () => Promise.resolve({ ok: true, data: data[key] }),
          })
        }
      } else if (unknownKeys === 'strict' && extraKeys.size > 0) {
        ctx.UNRECOGNIZED_KEYS({ keys: [...extraKeys] })
        if (ctx.common.abortEarly) {
          return ctx.ABORT()
        }
      }
    } else {
      for (const key of extraKeys) {
        const value = data[key]
        const catchallCtx = ctx.child({ type: catchall, data: value, path: [key] })
        parsePairs.set(key, {
          parseSync: () => catchall._parseSync(catchallCtx),
          parseAsync: () => catchall._parseAsync(catchallCtx),
        })
      }
    }

    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const result = {} as Record<string, unknown>
        for (const [key, parseFns] of parsePairs) {
          const valueResult = await parseFns.parseAsync()
          if (valueResult.ok) {
            if (valueResult.data !== undefined) {
              result[key] = valueResult.data
            }
          } else {
            if (ctx.common.abortEarly) {
              return ctx.ABORT()
            }
          }
        }
        return ctx.isValid() ? ctx.OK(result as this['_O']) : ctx.ABORT()
      })
    } else {
      const result = {} as Record<string, unknown>
      for (const [key, parseFns] of parsePairs) {
        const valueResult = parseFns.parseSync()
        if (valueResult.ok) {
          if (valueResult.data !== undefined) {
            result[key] = valueResult.data
          }
        } else {
          if (ctx.common.abortEarly) {
            return ctx.ABORT()
          }
        }
      }
      return ctx.isValid() ? ctx.OK(result as this['_O']) : ctx.ABORT()
    }
  }

  get shape(): S {
    return this._def.shape
  }

  get entries(): utils.Entries<S> {
    return utils.entries(this.shape)
  }

  passthrough(): TObject<S, 'passthrough', null> {
    return this._setUnknownKeys('passthrough')
  }

  strip(): TObject<S, 'strip', null> {
    return this._setUnknownKeys('strip')
  }

  strict(): TObject<S, 'strict', null> {
    return this._setUnknownKeys('strict')
  }

  catchall<C_ extends TObjectCatchall>(catchall: C_): TObject<S, null, C_> {
    return this._setCatchall(catchall)
  }

  keyof(): TEnum<{ readonly [K in keyof S & string]: K }> {
    return TEnum.create(utils.keys(this.shape) as unknown as EnumValues<keyof S & string>)
  }

  augment<T extends TObjectShape>(augmentation: T | AnyTObject<T>): TObject<utils.Merge<S, T>, U, C> {
    return this._setShape(utils.merge(this.shape, augmentation instanceof TObject ? augmentation.shape : augmentation))
  }

  extend<T extends TObjectShape>(extension: T | AnyTObject<T>): TObject<utils.Merge<S, T>, U, C> {
    return this.augment(extension)
  }

  setKey<K extends string, T extends AnyTType>(key: K, type: T): TObject<utils.Merge<S, { [k in K]: T }>, U, C> {
    return this.augment({ [key]: type } as { [k in K]: T })
  }

  diff<T extends TObjectShape>(other: T | AnyTObject<T>): TObject<utils.Diff<S, T>, U, C> {
    return this._setShape(utils.diff(this.shape, other instanceof TObject ? other.shape : other))
  }

  merge<S_ extends TObjectShape, U_ extends TObjectUnknownKeys | null, C_ extends TObjectCatchall | null>(
    incoming: TObject<S_, U_, C_>
  ) {
    return incoming._setShape(utils.merge(this.shape, incoming.shape))
  }

  mergeDeep<T extends AnyTObject>(incoming: T) {
    return incoming._setShape(utils.mergeDeep(this.shape, incoming.shape)) as unknown as MergeTObjectsDeep<this, T>
  }

  pick<K extends keyof S, T extends readonly [K, ...K[]]>(...keys: T): TObject<Pick<S, T[number]>, U, C>
  pick<K extends keyof S, T extends readonly [K, ...K[]]>(keys: T): TObject<Pick<S, T[number]>, U, C>
  pick<K extends keyof S, T extends readonly [K, ...K[]]>(...keys: T) {
    return this._setShape(utils.pick(this.shape, Array.isArray(keys[0]) ? keys[0] : keys))
  }

  omit<K extends keyof S, T extends readonly [K, ...K[]]>(...keys: T): TObject<Omit<S, T[number]>, U, C>
  omit<K extends keyof S, T extends readonly [K, ...K[]]>(keys: T): TObject<Omit<S, T[number]>, U, C>
  omit<K extends keyof S, T extends readonly [K, ...K[]]>(...keys: T) {
    return this._setShape(utils.omit(this.shape, Array.isArray(keys[0]) ? keys[0] : keys))
  }

  partial<K extends keyof S = keyof S, T extends readonly [K, ...K[]] = readonly [K, ...K[]]>(
    ...keys: T
  ): TObject<utils.Merge<S, ToTPartialObj<S, T[number]>>, U, C>
  partial<K extends keyof S = keyof S, T extends readonly [K, ...K[]] = readonly [K, ...K[]]>(
    keys?: T
  ): TObject<utils.Merge<S, ToTPartialObj<S, T[number]>>, U, C>
  partial(...keys: readonly (keyof S)[]): any {
    const keysArr = Array.isArray(keys[0]) ? keys[0] : keys
    return this._setShape(
      utils.fromEntries(
        utils
          .entries(this.shape)
          .map(([k, v]) => [
            k,
            (keysArr.length === 0 || utils.includes(keysArr, k)) && !(v instanceof TOptional)
              ? TOptional.create(v, v.options)
              : v,
          ])
      )
    )
  }

  partialDeep() {
    return makePartialDeep(this)
  }

  required<K extends keyof S = keyof S, T extends readonly [K, ...K[]] = readonly [K, ...K[]]>(
    this: this,
    ...keys: T
  ): TObject<utils.Merge<S, ToTRequiredObj<S, T[number]>>, U, C>
  required<K extends keyof S = keyof S, T extends readonly [K, ...K[]] = readonly [K, ...K[]]>(
    this: this,
    keys?: T
  ): TObject<utils.Merge<S, ToTRequiredObj<S, T[number]>>, U, C>
  required(this: never): never
  required(...keys: readonly (keyof S)[]) {
    const keysArr = Array.isArray(keys[0]) ? keys[0] : keys
    return this._setShape(
      Object.fromEntries(
        Object.entries(this.shape).map(([k, v]) => [
          k,
          (keysArr.length === 0 || utils.includes(keysArr, k)) && !(v instanceof TRequired) ? v.required() : v,
        ])
      )
    )
  }

  private _setShape<S_ extends TObjectShape>(shape: S_) {
    return new TObject({ ...this._def, shape })
  }

  private _setUnknownKeys<U_ extends TObjectUnknownKeys>(unknownKeys: U_) {
    return new TObject({ ...this._def, unknownKeys, catchall: null })
  }

  private _setCatchall<C_ extends TObjectCatchall>(catchall: C_) {
    return new TObject({ ...this._def, catchall, unknownKeys: null })
  }

  private static _create = <S extends TObjectShape>(shape: S, options?: CreateOptions) =>
    new TObject({
      typeName: TTypeName.Object,
      options,
      shape,
      unknownKeys: 'strip',
      catchall: null,
    })

  private static _createWithPassthrough = <S extends TObjectShape>(shape: S, options?: CreateOptions) =>
    TObject._create(shape, options).passthrough()

  private static _strictCreate = <S extends TObjectShape>(shape: S, options?: CreateOptions) =>
    TObject._create(shape, options).strict()

  private static _lazyCreate = <S extends TObjectShape>(shape: () => S, options?: CreateOptions) =>
    TObject._create(shape(), options)

  private static _createFromEntries = <E extends [string, AnyTType]>(entries: E[]) =>
    TObject._create(utils.fromEntries(entries))

  static create = Object.assign(this._create, {
    passthrough: this._createWithPassthrough,
    strict: this._strictCreate,
    lazy: this._lazyCreate,
    fromEntries: this._createFromEntries,
  })
}

export type AnyTObject<S extends TObjectShape = TObjectShape> = TObject<
  S,
  TObjectUnknownKeys | null,
  TObjectCatchall | null
>

/* ---------------------------------------------------------------------------------------------- */
/*                                            Function                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TFunctionDef<A extends AnyTTuple, R extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Function
  readonly args: A
  readonly returns: R
}

export class TFunction<A extends AnyTTuple, R extends AnyTType> extends TType<
  (...args: A['_I']) => R['_O'],
  TFunctionDef<A, R>,
  (...args: A['_O']) => R['_I']
> {
  protected readonly _hint = `(${this.parameters.items.map((i, idx) => `args_${idx}: ${i['_hint']}`).join(', ')}${
    this.parameters.restType
      ? `${this.parameters.items.length > 0 ? ', ' : ''}...args${
          this.parameters.items.length === 0 ? '' : `_${this.parameters.items.length}`
        }: ${this.parameters.restType['_hint']}[]`
      : ''
  }) => ${this.returnType['_hint']}`

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
        const parsedResult = await returnType.safeParseAsync(result, parseOptions)
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
  args<A_ extends TTupleItems, AR_ extends TTupleRest>(args: A_, rest: AR_): TFunction<TTuple<A_, AR_>, R>
  args(): TFunction<TTuple<[], null>, R>
  args<A_ extends TTupleItems, AR_ extends TTupleRest>(args?: A_, rest?: AR_) {
    return new TFunction({
      ...this._def,
      args: args ? (rest ? TTuple.create(args, rest) : TTuple.create(args)) : TTuple.create([]),
    })
  }

  returns<R_ extends AnyTType>(returns: R_): TFunction<A, R_> {
    return new TFunction({ ...this._def, returns })
  }

  implement<F extends (...args: A['_O']) => R['_I']>(
    fn: F
  ): ReturnType<F> extends R['_O'] ? (...args: A['_I']) => ReturnType<F> : (...args: A['_I']) => R['_O'] {
    return this.parse(fn) as ReturnType<F> extends R['_O']
      ? (...args: A['_I']) => ReturnType<F>
      : (...args: A['_I']) => R['_O']
  }

  strictImplement(fn: (...args: A['_O']) => R['_I']): (...args: A['_O']) => R['_I'] {
    return this.parse(fn)
  }

  validate<F extends (...args: A['_O']) => R['_I']>(fn: F) {
    return this.implement(fn)
  }

  decorate(): (
    target: unknown,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<this['_O']>
  ) => TypedPropertyDescriptor<this['_O']> {
    return TDecorator.create<A, R, this>(this)
  }

  private static _create<A extends TTupleItems>(args: A, options?: CreateOptions): TFunction<TTuple<A, null>, TUnknown>
  private static _create<A extends AnyTTuple>(args: A, options?: CreateOptions): TFunction<A, TUnknown>
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
  private static _create(options?: CreateOptions): TFunction<TTuple<[], TUnknown>, TUnknown>
  private static _create(
    tupleItemsTupleOrOptions?: TTupleItems | AnyTTuple | CreateOptions,
    returnsOrOptions?: AnyTType | CreateOptions,
    options?: CreateOptions
  ): TFunction<any, any> {
    return new TFunction({
      typeName: TTypeName.Function,
      options:
        tupleItemsTupleOrOptions instanceof TTuple || utils.isArray(tupleItemsTupleOrOptions)
          ? returnsOrOptions instanceof TType
            ? options
            : returnsOrOptions
          : tupleItemsTupleOrOptions,
      args:
        tupleItemsTupleOrOptions instanceof TTuple
          ? tupleItemsTupleOrOptions
          : utils.isArray(tupleItemsTupleOrOptions)
          ? TTuple.create(tupleItemsTupleOrOptions)
          : TTuple.create([], TUnknown.create()),
      returns: returnsOrOptions instanceof TType ? returnsOrOptions : TUnknown.create(),
      rules: [],
    })
  }

  static create = this._create
}

export type AnyTFunction = TFunction<AnyTTuple, AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                              Union                                             */
/* ---------------------------------------------------------------------------------------------- */

export type TUnionMembers = readonly [AnyTType, AnyTType, ...AnyTType[]]

export const flattenUnionMembers = <T extends TUnionMembers>(members: T): T =>
  members.flatMap((m) => (m instanceof TUnion ? flattenUnionMembers(m.members) : [m])) as unknown as T

export interface TUnionDef<T extends TUnionMembers> extends TDef {
  readonly typeName: TTypeName.Union
  readonly members: T
}

export class TUnion<T extends TUnionMembers> extends TType<T[number]['_O'], TUnionDef<T>, T[number]['_I']> {
  protected readonly _hint = this.members.map((m) => m['_hint']).join(' | ')

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const flattenedMembers = flattenUnionMembers(this.members)

    const handleResults = (results: readonly SyncParseResultOf<this>[]): ParseResultOf<this> => {
      const successfulResults = results.filter((result) => !!result.ok)
      return successfulResults.length > 0
        ? ctx.OK(successfulResults[0].data)
        : ctx
            .INVALID_UNION({
              issues: results
                .map((result) => result.error)
                .filter(utils.isDefined)
                .flatMap((error) => error.issues),
            })
            .ABORT()
    }

    if (ctx.common.async) {
      return Promise.all(flattenedMembers.map((member) => member._parseAsync(ctx.clone({ type: member })))).then(
        handleResults
      )
    } else {
      const results = flattenedMembers.map((member) => member._parseSync(ctx.clone({ type: member })))
      return handleResults(results)
    }
  }

  get members(): T {
    return this._def.members
  }

  static create = <T extends TUnionMembers>(members: T, options?: CreateOptions): TUnion<T> =>
    new TUnion({ typeName: TTypeName.Union, options, members })
}

export type AnyTUnion = TUnion<TUnionMembers>

/* ---------------------------------------------------------------------------------------------- */
/*                                          Intersection                                          */
/* ---------------------------------------------------------------------------------------------- */

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

export type IntersectionResult<T, U> = SuccessfulIntersectionResult<T, U> | FailedIntersectionResult

const intersect = <O>(outputs: readonly SuccessfulParseResult<O>[]) => {
  const intersectTwo = <T, U>(a: T, b: U): IntersectionResult<T, U> => {
    const aType = getParsedType(a)
    const bType = getParsedType(b)

    if (aType === bType) {
      return { valid: true, value: a as T & U }
    } else if (utils.isObject(a) && utils.isObject(b)) {
      const bKeys = Object.keys(b)
      const sharedKeys = Object.keys(a).filter((k) => bKeys.indexOf(k) !== -1) as unknown as readonly (keyof (T | U))[]
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
        value: intersected.map((i) => (i as SuccessfulIntersectionResult<T, U>).value) as T & U,
      }
    } else if (a instanceof Date && b instanceof Date && +a === +b) {
      return { valid: true, value: a as T & U }
    } else {
      return { valid: false }
    }
  }

  return outputs
    .slice(2)
    .reduce((a, b) => intersectTwo(a.value, b.data), intersectTwo(outputs[0].data, outputs[1].data))
}

export class TIntersection<T extends TIntersectionMembers> extends TType<
  utils.UnionToIntersection<T[number]['_O']>,
  TIntersectionDef<T>,
  utils.UnionToIntersection<T[number]['_I']>
> {
  protected readonly _hint = this.members.map((m) => m['_hint']).join(' & ')

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const handleIntersection = <O, I, T extends readonly SyncParseResult<O, I>[]>(results: T): ParseResultOf<this> => {
      if (results.some((res) => !res.ok)) {
        return ctx.ABORT()
      }
      const data = intersect(results as readonly SuccessfulParseResult<this['_O']>[])
      if (data.valid) {
        return ctx.OK(data.value)
      } else {
        return ctx.INVALID_INTERSECTION().ABORT()
      }
    }

    if (ctx.common.async) {
      return Promise.all(this.members.map((member) => member._parseAsync(ctx.clone({ type: member })))).then(
        handleIntersection
      )
    } else {
      const results = this.members.map((member) => member._parseSync(ctx.clone({ type: member })))
      return handleIntersection(results)
    }
  }

  get members(): T {
    return this._def.members
  }

  static create = <T extends TIntersectionMembers>(members: T, options?: CreateOptions): TIntersection<T> =>
    new TIntersection({ typeName: TTypeName.Intersection, options, members })
}

export type AnyTIntersection = TIntersection<TIntersectionMembers>

/* ---------------------------------------------------------------------------------------------- */
/*                                             Effects                                            */
/* ---------------------------------------------------------------------------------------------- */

export enum EffectKind {
  Preprocess = 'preprocess',
  Refinement = 'refinement',
  Transform = 'transform',
}

export interface EffectContext<O, I = O> {
  readonly issue: ParseContext<O, I>['DIRTY']
  readonly path: ParsePath
}

export type EffectContextOf<T extends AnyTType> = EffectContext<T['_O'], T['_I']>

const createEffectContext = <O, I = O>(parseCtx: ParseContext<O, I>): EffectContext<O, I> => ({
  issue: (...args) => parseCtx['DIRTY'](...args),
  path: [...parseCtx.path],
})

export interface BaseEffect<K extends EffectKind> {
  readonly kind: K
}

export interface PreprocessEffect<T> extends BaseEffect<EffectKind.Preprocess> {
  readonly transform: (data: unknown) => T
}

export interface RefinementEffect<T extends AnyTType> extends BaseEffect<EffectKind.Refinement> {
  readonly refine: (data: T['_O'], ctx: EffectContextOf<T>) => boolean | Promise<boolean>
}

export interface TransformEffect<T extends AnyTType, O> extends BaseEffect<EffectKind.Transform> {
  readonly transform: (data: T['_O'], ctx: EffectContextOf<T>) => O | Promise<O>
}

export type TEffect<T = unknown, U = unknown> =
  | PreprocessEffect<T>
  | RefinementEffect<T & AnyTType>
  | TransformEffect<T & AnyTType, U>

export type RefinementMsgParams = RequireAtLeastOne<Issue<IssueKind.Custom>['payload']> & {
  readonly message: string
}

export type RefinementMsgArg<T> = string | RefinementMsgParams | ((data: T) => RefinementMsgParams)

type RefinementExecutorCreator<Async extends boolean = false> = <O, I>(
  effect: RefinementEffect<AnyTType<O, I>>,
  effectCtx: EffectContext<O, I>
) => (data: O) => Async extends true ? Promise<boolean> : boolean

const createSyncRefinementExecutor: RefinementExecutorCreator = (effect, effectCtx) => (data) => {
  const result = effect.refine(data, effectCtx)
  if (result instanceof Promise) {
    throw new TypeError('Async refinement encountered during synchronous parse operation. Use `.parseAsync` instead.')
  }
  return result
}

const createAsyncRefinementExecutor: RefinementExecutorCreator<true> = (effect, effectCtx) => async (data) =>
  effect.refine(data, effectCtx)

export interface TEffectsDef<T extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Effects
  readonly type: T
  readonly effect: TEffect
}

export type GetTEffectsSource<T> = T extends AnyTEffects ? T['source'] : T

export class TEffects<T extends AnyTType<any>, O = T['_O'], I = T['_I']> extends TType<O, TEffectsDef<T>, I> {
  protected readonly _hint: string = this.source['_hint']

  _parse(ctx: ParseContextOf<this>): ParseResultOf<this> {
    const { effect } = this._def

    if (effect.kind === EffectKind.Preprocess) {
      const processed = effect.transform(ctx.data)
      return ctx.common.async
        ? Promise.resolve(processed).then((processedAsync) => {
            ctx.setData(processedAsync as O)
            return this.underlying._parseAsync(ctx.clone({ type: this.underlying }))
          })
        : ctx.setData(processed as O) && this.underlying._parseSync(ctx.clone({ type: this.underlying }))
    }

    const effectCtx = createEffectContext(ctx)

    if (effect.kind === EffectKind.Refinement) {
      if (ctx.common.async) {
        const executeRefinement = createAsyncRefinementExecutor(effect, effectCtx)
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
        const executeRefinement = createSyncRefinementExecutor(effect, effectCtx)
        const underlyingRes = this.underlying._parseSync(ctx.clone({ type: this.underlying }))
        return underlyingRes.ok && executeRefinement(underlyingRes.data) ? ctx.OK(underlyingRes.data) : ctx.ABORT()
      }
    }

    if (effect.kind === EffectKind.Transform) {
      if (ctx.common.async) {
        return this.underlying._parseAsync(ctx.clone({ type: this.underlying })).then((baseRes) => {
          if (!baseRes.ok) {
            return ctx.ABORT()
          }
          return Promise.resolve(effect.transform(baseRes.data, effectCtx)).then((result) =>
            ctx.isInvalid() ? ctx.ABORT() : ctx.OK(result as T['_O'])
          )
        })
      } else {
        const baseRes = this.underlying._parseSync(ctx.clone({ type: this.underlying }))
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
    return this.underlying instanceof TEffects ? this.underlying.source : this.underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): GetTEffectsSource<T> {
    return this.source
  }

  private static _create = <T extends AnyTType, O = T['_O'], I = T['_I'], E extends TEffect = TEffect>(
    type: T,
    effect: E,
    options: CreateOptions | undefined
  ) =>
    new TEffects<T, O, I>({
      typeName: TTypeName.Effects,
      options,
      type,
      effect,
      meta: type.meta,
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
            ctx.issue(IssueKind.Custom, issuePayload)
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
    TEffects._create<T, O, T['_I'], TransformEffect<T, O>>(type, { kind: EffectKind.Transform, transform }, options)
}

export type AnyTEffects = TEffects<AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                            Pipeline                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface TPipelineDef<In extends AnyTType, Out extends AnyTType> extends TDef {
  readonly typeName: TTypeName.Pipeline
  readonly in: In
  readonly out: Out
}

export class TPipeline<In extends AnyTType, Out extends AnyTType> extends TType<
  Out['_O'],
  TPipelineDef<In, Out>,
  In['_I']
> {
  protected readonly _hint = `Pipeline<${this.out['_hint']}, ${this.in['_hint']}>`

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

  static create = <A, B, C, In extends AnyTType<B, A>, Out extends AnyTType<C, B>>(
    a: In,
    b: Out,
    options?: CreateOptions
  ): TPipeline<In, Out> => new TPipeline<In, Out>({ typeName: TTypeName.Pipeline, options, in: a, out: b })
}

export type AnyTPipeline = TPipeline<AnyTType, AnyTType>

/* ---------------------------------------------------------------------------------------------- */
/*                                             Extras                                             */
/* ---------------------------------------------------------------------------------------------- */

export const TNullish: {
  readonly create: <T extends AnyTType>(underlying: T, options?: CreateOptions) => TOptional<TNullable<T>>
} = {
  create: (underlying, options) => TOptional.create(TNullable.create(underlying, options), options),
}

export const TDecorator: {
  readonly create: <A extends AnyTTuple, R extends AnyTType, Fn extends TFunction<A, R> = TFunction<A, R>>(
    fn: Fn
  ) => (
    target: unknown,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<Fn['_O']>
  ) => TypedPropertyDescriptor<Fn['_O']>
} = {
  create: (fn) => (target, _propertyKey, descriptor) => {
    const originalMethod = descriptor.value
    descriptor.value = (...args) => {
      const validatedFunc = fn.parse(originalMethod)
      return validatedFunc.bind(target)(...args)
    }
    return descriptor
  },
}

/* ---------------------------------------------------------------------------------------------- */

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
  Required = 'TRequired',
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
  [TTypeName.Required]: AnyTRequired
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

/* ---------------------------------------------------------------------------------------------- */

export const tany = TAny.create
export const tarray = TArray.create
export const tbigint = TBigInt.create
export const tbool = TBoolean.create // alias for `tboolean`
export const tboolean = TBoolean.create
export const tbranded = TBranded.create
export const tcatch = TCatch.create
export const tdate = TDate.create
export const tdecorate = TDecorator.create // alias for `tdecorator`
export const tdecorator = TDecorator.create
export const tdefault = TDefault.create
export const tenum = TEnum.create
export const tfalse = TFalse.create
export const tfn = TFunction.create // alias for `tfunction`
export const tfunction = TFunction.create
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
export const trequired = TRequired.create
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
  inferFlattenedError,
  inferFormattedError,
  tany as any,
  tarray as array,
  tbigint as bigint,
  tbool as bool,
  tboolean as boolean,
  tbranded as branded,
  tcatch as catch,
  tdate as date,
  tdecorate as decorate,
  tdecorator as decorator,
  tdefault as default,
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
  trequired as required,
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

/* ---------------------------------------------------------------------------------------------- */

export type output<T extends AnyTType> = utils.FixEmptyObject<T['_O']>
export type input<T extends AnyTType> = utils.FixEmptyObject<T['_I']>
export type infer<T extends AnyTType> = output<T>

/* ---------------------------------- Utils --------------------------------- */

export type ToTPartialObj<T, K extends keyof T = keyof T> = {
  [K_ in K]: T[K_] extends AnyTOptional ? T[K_] : T[K_] extends AnyTType ? TOptional<T[K_]> : never
}

export type SetPartialArr<T extends readonly [AnyTType, ...AnyTType[]] | readonly []> = T extends readonly []
  ? T
  : T extends [infer H extends AnyTType, ...infer R]
  ? [
      H extends AnyTOptional ? H : TOptional<H>,
      ...(R extends readonly [AnyTType, ...AnyTType[]]
        ? SetPartialArr<R>
        : R extends readonly [AnyTType]
        ? R[0] extends AnyTOptional
          ? R[0]
          : TOptional<R[0]>
        : [])
    ]
  : never

export type ToTRequiredObj<T, K extends keyof T = keyof T> = {
  [K_ in K]: T[K_] extends AnyTRequired ? T[K_] : T[K_] extends AnyTType ? TRequired<T[K_]> : never
}
