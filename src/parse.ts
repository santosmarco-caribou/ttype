import { DEFAULT_ERROR_MAP, ErrorMap, TError, resolveErrorMap } from './error'
import { TGlobal } from './global'
import { IssueKind, NoMsgIssue, type Issue } from './issues'
import type { AnyTType } from './types'
import { utils } from './utils'

/* -------------------------------------------------------------------------- */
/*                                 ParseResult                                */
/* -------------------------------------------------------------------------- */

export interface SuccessfulParseResult<O = unknown> {
  readonly ok: true
  readonly data: O
  readonly error?: never
}

export interface FailedParseResult<O = unknown, I = O> {
  readonly ok: false
  readonly data?: never
  readonly error: TError<O, I>
}

export type SyncParseResult<O = unknown, I = O> =
  | SuccessfulParseResult<O>
  | FailedParseResult<O, I>
export type AsyncParseResult<O = unknown, I = O> = Promise<
  SyncParseResult<O, I>
>
export type ParseResult<O = unknown, I = O> =
  | SyncParseResult<O, I>
  | AsyncParseResult<O, I>

export type SyncParseResultOf<T extends AnyTType> = SyncParseResult<
  T['_O'],
  T['_I']
>
export type AsyncParseResultOf<T extends AnyTType> = AsyncParseResult<
  T['_O'],
  T['_I']
>
export type ParseResultOf<T extends AnyTType> = ParseResult<T['_O'], T['_I']>

/* -------------------------------------------------------------------------- */
/*                                ParseContext                                */
/* -------------------------------------------------------------------------- */

export type ParsePath = readonly (string | number)[]

export enum ParseStatus {
  Valid = 'valid',
  Invalid = 'invalid',
}

export interface ParseOptions {
  readonly abortEarly?: boolean
  readonly errorMap?: ErrorMap
}

export interface ParseContextCommon extends ParseOptions {
  readonly async: boolean
}

export interface ParseContextCloneDef<O = unknown, I = O> {
  readonly type: AnyTType<O, I>
}

export interface ParseContextChildDef<D = unknown, O = unknown, I = O>
  extends ParseContextCloneDef<O, I> {
  data: D
  readonly path: ParsePath
}

export interface ParseContextDef<D = unknown, O = unknown, I = O>
  extends ParseContextChildDef<D, O, I> {
  status: ParseStatus
  readonly parent: ParseContext | null
  readonly common: ParseContextCommon
  readonly ownChildren: ParseContext[]
  readonly ownIssues: Issue[]
}

export class ParseContext<D = unknown, O = unknown, I = O> {
  private readonly _def: ParseContextDef<D, O, I>

  private constructor(def: ParseContextDef<D, O, I>) {
    this._def = def
  }

  get data(): D {
    return utils.cloneDeep(this._def.data)
  }

  get dataType(): TParsedType {
    return getParsedType(this.data)
  }

  setData<D_ extends D>(data: D_): ParseContext<D_, O, I> {
    this._def.data = data
    return this as unknown as ParseContext<D_, O, I>
  }

  get type(): AnyTType<O, I> {
    return this._def.type
  }

  get path(): ParsePath {
    return this._def.path
  }

  get parent(): ParseContext | null {
    return this._def.parent
  }

  get common(): ParseContextCommon {
    return this._def.common
  }

  get ownChildren(): readonly ParseContext[] {
    return this._def.ownChildren
  }

  get allChildren(): readonly ParseContext[] {
    return this.ownChildren.concat(
      this.ownChildren.flatMap((child) => child.allChildren)
    )
  }

  get ownIssues(): readonly Issue[] {
    return this._def.ownIssues
  }

  get allIssues(): readonly Issue[] {
    return this.ownIssues.concat(
      this.allChildren.flatMap((child) => child.allIssues)
    )
  }

  child<D_, O_, I_>(
    def: ParseContextChildDef<D_, O_, I_>
  ): ParseContext<D_, O_, I_> {
    const { type, data, path } = def
    const child = new ParseContext({
      type,
      data,
      path: this.path.concat(path),
      status: ParseStatus.Valid,
      parent: this,
      common: this.common,
      ownChildren: [],
      ownIssues: [],
    })
    this._def.ownChildren.push()
    return child
  }

  clone<O_, I_>(def: ParseContextCloneDef<O_, I_>): ParseContext<D, O_, I_> {
    const { type } = def
    const clone = new ParseContext({
      type,
      status: ParseStatus.Valid,
      data: this.data,
      path: this.path,
      parent: this.parent,
      common: this.common,
      ownChildren: [],
      ownIssues: [],
    })
    this._def.ownChildren.push()
    return clone
  }

  isValid(): boolean {
    return (
      this._def.status === ParseStatus.Valid &&
      this.allChildren.every((child) => child.isValid())
    )
  }

  isInvalid(): boolean {
    return (
      this._def.status === ParseStatus.Invalid ||
      this.allChildren.some((child) => child.isInvalid())
    )
  }

  setInvalid(): this {
    if (this._def.status === ParseStatus.Invalid) {
      return this
    }
    this._def.status = ParseStatus.Invalid
    this._def.parent?.setInvalid()
    return this
  }

  DIRTY<K extends IssueKind>(
    kind: K,
    ...args: 'payload' extends keyof Issue<K>
      ? [payload: Issue<K>['payload'], message?: string]
      : [message?: string]
  ): this {
    if (this.isInvalid()) {
      if (this.common.abortEarly) {
        return this
      }
    } else {
      this.setInvalid()
    }

    const [payload, message] =
      typeof args[0] === 'string' ? [undefined, args[0]] : [args[0], args[1]]

    const issue = {
      kind,
      payload,
      input: { data: this.data, parsedType: this.dataType },
      path: this.path,
      type: this.type,
    } as NoMsgIssue

    const issueMessage =
      message ??
      [
        this.common.errorMap,
        this.type.options.errorMap,
        TGlobal.getErrorMap(),
        DEFAULT_ERROR_MAP,
      ]
        .filter(utils.isDefined)
        .reverse()
        .reduce(
          (msg, map) => resolveErrorMap(map)(issue, { defaultMessage: msg }),
          ''
        )

    this._def.ownIssues.push({ ...issue, message: issueMessage } as Issue)

    return this
  }

  OK<T extends O>(data: T): SuccessfulParseResult<T> {
    return { ok: true, data }
  }

  ABORT(): FailedParseResult<O, I> {
    return { ok: false, error: new TError(this) }
  }

  INVALID_TYPE(payload: { readonly expected: TParsedType }): this {
    return this.data === undefined
      ? this.DIRTY(IssueKind.Required)
      : this.DIRTY(IssueKind.InvalidType, {
          expected: payload.expected,
          received: this.dataType,
        })
  }

  INVALID_ENUM_VALUE(payload: {
    readonly expected: readonly (string | number)[]
    readonly received: string | number
  }) {
    return this.DIRTY(IssueKind.InvalidEnumValue, {
      expected: {
        values: payload.expected,
        formatted: payload.expected.map(utils.literalize).join(' | '),
      },
      received: {
        value: payload.received,
        formatted: utils.literalize(payload.received),
      },
    })
  }

  INVALID_LITERAL(payload: {
    readonly expected: utils.Primitive
    readonly received: utils.Primitive
  }): this {
    const makeExpectedReceived = (value: utils.Primitive) => ({
      value,
      formatted: utils.literalize(value),
    })
    return this.DIRTY(IssueKind.InvalidLiteral, {
      expected: makeExpectedReceived(payload.expected),
      received: makeExpectedReceived(payload.received),
    })
  }

  INVALID_UNION(payload: { errors: readonly TError[] }) {
    return this.DIRTY(IssueKind.InvalidUnion, { unionErrors: payload.errors })
  }

  INVALID_INTERSECTION() {
    return this.DIRTY(IssueKind.InvalidIntersection)
  }

  INVALID_INSTANCE(payload: { readonly expected: string }): this {
    return this.DIRTY(IssueKind.InvalidInstance, {
      expected: { className: payload.expected },
    })
  }

  UNRECOGNIZED_KEYS(payload: { readonly keys: string[] }): this {
    return this.DIRTY(IssueKind.UnrecognizedKeys, payload)
  }

  FORBIDDEN(): this {
    return this.DIRTY(IssueKind.Forbidden)
  }

  static createSync<D, O, I>(
    type: AnyTType<O, I>,
    data: D,
    options: ParseOptions | undefined
  ): ParseContext<D, O, I> {
    return new ParseContext({
      type,
      data,
      path: [],
      status: ParseStatus.Valid,
      parent: null,
      common: { ...options, async: false },
      ownChildren: [],
      ownIssues: [],
    })
  }

  static createAsync<D, O, I>(
    type: AnyTType<O, I>,
    data: D,
    options: ParseOptions | undefined
  ): ParseContext<D, O, I> {
    return new ParseContext({
      type,
      data,
      path: [],
      status: ParseStatus.Valid,
      parent: null,
      common: { ...type.options, ...options, async: true },
      ownChildren: [],
      ownIssues: [],
    })
  }
}

export type ParseContextOf<T extends AnyTType> = ParseContext<
  unknown,
  T['_O'],
  T['_I']
>

/* -------------------------------------------------------------------------- */
/*                                 ParsedType                                 */
/* -------------------------------------------------------------------------- */

export enum TParsedType {
  Array = 'Array',
  BigInt = 'bigint',
  Boolean = 'boolean',
  Buffer = 'Buffer',
  Date = 'Date',
  EnumValue = 'string | number',
  False = 'false',
  Function = 'function',
  Map = 'Map',
  NaN = 'NaN',
  Null = 'null',
  Number = 'number',
  Object = 'object',
  Primitive = 'string | number | bigint | boolean | symbol | null | undefined',
  Promise = 'Promise',
  RegExp = 'RegExp',
  Set = 'Set',
  String = 'string',
  Symbol = 'symbol',
  True = 'true',
  Undefined = 'undefined',
  Unknown = 'unknown',
  Void = 'void',
}

export const getParsedType = (data: unknown): TParsedType => {
  switch (typeof data) {
    case 'string':
      return TParsedType.String
    case 'number':
      if (Number.isNaN(data)) return TParsedType.NaN
      else return TParsedType.Number
    case 'bigint':
      return TParsedType.BigInt
    case 'boolean':
      return TParsedType.Boolean
    case 'symbol':
      return TParsedType.Symbol
    case 'function':
      return TParsedType.Function
    case 'undefined':
      return TParsedType.Undefined
    case 'object':
      if (data === null) return TParsedType.Null
      if (Array.isArray(data)) return TParsedType.Array
      if (data instanceof Buffer) return TParsedType.Buffer
      if (data instanceof Date) return TParsedType.Date
      if (data instanceof Map) return TParsedType.Map
      if (data instanceof Promise) return TParsedType.Promise
      if (data instanceof RegExp) return TParsedType.RegExp
      if (data instanceof Set) return TParsedType.Set
      if (utils.isObject(data)) return TParsedType.Object
      else return TParsedType.Unknown
  }
}
