import { nanoid } from 'nanoid'
import {
  TError,
  getDefaultErrorMap,
  resolveErrorMap,
  type ErrorMap,
} from './error'
import { TGlobal } from './global'
import {
  IssueKind,
  type Issue,
  type IssueInput,
  type IssueMetadata,
  type IssueTypeInfo,
  type NoMsgIssue,
} from './issues'
import type { AnyTType, EnumValue, EnumValues } from './types'
import { utils } from './utils'

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                     ParseResult                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

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

export type SuccessfulParseResultOf<T extends AnyTType> = SuccessfulParseResult<
  T['_O']
>
export type FailedParseResultOf<T extends AnyTType> = FailedParseResult<
  T['_O'],
  T['_I']
>
export type SyncParseResultOf<T extends AnyTType> = SyncParseResult<
  T['_O'],
  T['_I']
>
export type AsyncParseResultOf<T extends AnyTType> = AsyncParseResult<
  T['_O'],
  T['_I']
>
export type ParseResultOf<T extends AnyTType> = ParseResult<T['_O'], T['_I']>

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                    ParseContext                                                    */
/* ------------------------------------------------------------------------------------------------------------------ */

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

export interface ParseContextCloneDef<O, I> {
  readonly type: AnyTType<O, I>
}

export interface ParseContextChildDef<O, I> extends ParseContextCloneDef<O, I> {
  readonly data: unknown
  readonly path: ParsePath
}

export interface ParseContextDef<O = unknown, I = O>
  extends ParseContextChildDef<O, I> {
  readonly parent: ParseContext | null
  readonly common: ParseContextCommon
}

export class ParseContext<O = unknown, I = O> {
  private _status: ParseStatus = ParseStatus.Valid
  private _data: unknown

  readonly type: AnyTType<O, I>
  readonly path: ParsePath
  readonly parent: ParseContext | null
  readonly common: ParseContextCommon

  private readonly _ownChildren: ParseContext[] = []
  private readonly _issues: Issue[] = []

  private constructor(def: ParseContextDef<O, I>) {
    this._data = def.data
    this.type = def.type
    this.path = def.path
    this.parent = def.parent
    this.common = def.common
  }

  get data(): unknown {
    return utils.cloneDeep(this._data)
  }

  get dataType(): TParsedType {
    return getParsedType(this.data)
  }

  setData(data: unknown): this {
    this._data = data
    return this
  }

  get allChildren(): readonly ParseContext[] {
    return this._ownChildren.concat(
      this._ownChildren.flatMap((child) => child.allChildren)
    )
  }

  get issues(): readonly Issue[] {
    return this._issues
  }

  child<O_, I_>(def: ParseContextChildDef<O_, I_>): ParseContext<O_, I_> {
    const child = new ParseContext({
      type: def.type,
      data: def.data,
      path: this.path.concat(def.path),
      parent: this,
      common: this.common,
    })
    this._ownChildren.push(child)
    return child
  }

  clone<O_, I_>(def: ParseContextCloneDef<O_, I_>): ParseContext<O_, I_> {
    const clone = new ParseContext({
      type: def.type,
      data: this.data,
      path: this.path,
      parent: this.parent,
      common: this.common,
    })
    this._ownChildren.push(clone)
    return clone
  }

  isValid(): boolean {
    return (
      this._status === ParseStatus.Valid &&
      this.allChildren.every((child) => child.isValid())
    )
  }

  isInvalid(): boolean {
    return (
      this._status === ParseStatus.Invalid ||
      this.allChildren.some((child) => child.isInvalid())
    )
  }

  private _setInvalid(): this {
    if (this._status === ParseStatus.Invalid) {
      return this
    }
    this._status = ParseStatus.Invalid
    this.parent?._setInvalid()
    return this
  }

  private _setIssue(issue: Issue): this {
    this._issues.push(issue)
    this.parent?._setIssue(issue)
    return this
  }

  DIRTY<K extends IssueKind>(
    kind: K,
    ...args: Issue<K>['payload'] extends undefined
      ? []
      : [payload: Issue<K>['payload']]
  ): this {
    if (this.isInvalid()) {
      if (this.common.abortEarly) {
        return this
      }
    } else {
      this._setInvalid()
    }

    const issuePayload = args[0]
    const issueInput: IssueInput = {
      data: this.data,
      parsedType: this.dataType,
    }
    const issueTypeInfo: IssueTypeInfo = {
      name: this.type.typeName,
      hint: this.type.show({ colors: false }),
      meta: this.type.meta,
    }
    const issueMetadata: IssueMetadata = { id: nanoid(), timestamp: Date.now() }

    const issue = {
      kind,
      path: this.path,
      payload: issuePayload,
      input: issueInput,
      type: issueTypeInfo,
      _meta: issueMetadata,
    } as NoMsgIssue

    const issueMessage =
      issuePayload && 'message' in issuePayload && !!issuePayload.message
        ? issuePayload.message
        : [
            this.common.errorMap,
            this.type.options.errorMap,
            TGlobal.getErrorMap(),
            getDefaultErrorMap(),
          ]
            .filter(utils.isDefined)
            .reverse()
            .reduce(
              (msg, map) => resolveErrorMap(map)(issue, { defaultMsg: msg }),
              ''
            )

    this._setIssue({ ...issue, message: issueMessage } as Issue)

    return this
  }

  OK<T extends O>(data: T): SuccessfulParseResult<T> {
    return { ok: true, data }
  }

  ABORT(): FailedParseResult<O, I> {
    return { ok: false, error: new TError(this) }
  }

  REQUIRED(): this {
    return this.DIRTY(IssueKind.Required)
  }

  INVALID_TYPE(payload: { readonly expected: TParsedType }): this {
    return this.data === undefined
      ? this.REQUIRED()
      : this.DIRTY(IssueKind.InvalidType, {
          expected: payload.expected,
          received: this.dataType,
        })
  }

  INVALID_ENUM_VALUE(payload: {
    readonly expected: EnumValues
    readonly received: EnumValue
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
    return this.DIRTY(IssueKind.InvalidLiteral, {
      expected: {
        value: payload.expected,
        formatted: utils.literalize(payload.expected),
      },
      received: {
        value: payload.received,
        formatted: utils.literalize(payload.received),
      },
    })
  }

  INVALID_ARGUMENTS(payload: { readonly error: TError }) {
    return this.DIRTY(IssueKind.InvalidArguments, {
      issues: payload.error.issues,
    })
  }

  INVALID_RETURN_TYPE(payload: { readonly error: TError }) {
    return this.DIRTY(IssueKind.InvalidReturnType, {
      issues: payload.error.issues,
    })
  }

  INVALID_UNION(payload: { readonly issues: readonly Issue[] }) {
    return this.DIRTY(IssueKind.InvalidUnion, { unionIssues: payload.issues })
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

  private static _makeBuilder =
    (async: boolean) =>
    <O, I>(
      type: AnyTType<O, I>,
      data: unknown,
      options: ParseOptions | undefined
    ) =>
      new ParseContext({
        type,
        data,
        path: [],
        parent: null,
        common: {
          ...TGlobal.getOptions(),
          ...type.options,
          ...options,
          async,
        },
      })

  static createSync = this._makeBuilder(false)
  static createAsync = this._makeBuilder(true)
}

export type ParseContextOf<T extends AnyTType> = ParseContext<T['_O'], T['_I']>

/* ------------------------------------------------------------------------------------------------------------------ */
/*                                                     ParsedType                                                     */
/* ------------------------------------------------------------------------------------------------------------------ */

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
