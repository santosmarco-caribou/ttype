import type { ParsePath, TParsedType } from './parse'
import type {
  EnumValue,
  EnumValues,
  TArrayCheck,
  TDateCheck,
  TMeta,
  TSetCheck,
  TStringCheck,
  TTupleCheck,
  TTypeName,
} from './types'
import type { utils } from './utils'

export enum IssueKind {
  Required = 'required',
  InvalidType = 'invalid_type',
  InvalidString = 'invalid_string',
  InvalidArray = 'invalid_array',
  InvalidDate = 'invalid_date',
  InvalidSet = 'invalid_set',
  InvalidTuple = 'invalid_tuple',
  InvalidEnumValue = 'invalid_enum_value',
  InvalidLiteral = 'invalid_literal',
  InvalidArguments = 'invalid_arguments',
  InvalidReturnType = 'invalid_return_type',
  InvalidUnion = 'invalid_union',
  InvalidIntersection = 'invalid_intersection',
  InvalidInstance = 'invalid_instance',
  UnrecognizedKeys = 'unrecognized_keys',
  Forbidden = 'forbidden',
  Custom = 'custom',
}

export type IssuePayload = Record<string, unknown> | null

export interface IssueInput {
  readonly data: unknown
  readonly parsedType: TParsedType
}

export interface IssueTypeInfo {
  readonly name: TTypeName
  readonly hint: string
  readonly meta: TMeta<any>
}

export interface IssueMetadata {
  readonly id: string
  readonly timestamp: number
}

type MakeIssue<P extends IssuePayload> = {
  readonly path: ParsePath
  readonly message: string
  readonly input: IssueInput
  readonly type: IssueTypeInfo
  readonly _meta: IssueMetadata
} & (P extends null ? { readonly payload?: never } : { readonly payload: P })

export type IssueMap = {
  [IssueKind.Required]: MakeIssue<null>
  [IssueKind.InvalidType]: MakeIssue<{
    readonly expected: TParsedType
    readonly received: TParsedType
  }>
  [IssueKind.InvalidString]: MakeIssue<TStringCheck>
  [IssueKind.InvalidArray]: MakeIssue<TArrayCheck>
  [IssueKind.InvalidDate]: MakeIssue<TDateCheck>
  [IssueKind.InvalidSet]: MakeIssue<TSetCheck>
  [IssueKind.InvalidTuple]: MakeIssue<TTupleCheck>
  [IssueKind.InvalidEnumValue]: MakeIssue<{
    readonly expected: {
      readonly values: EnumValues
      readonly formatted: string
    }
    readonly received: { readonly value: EnumValue; readonly formatted: string }
  }>
  [IssueKind.InvalidLiteral]: MakeIssue<{
    readonly expected: {
      readonly value: utils.Primitive
      readonly formatted: string
    }
    readonly received: {
      readonly value: utils.Primitive
      readonly formatted: string
    }
  }>
  [IssueKind.InvalidArguments]: MakeIssue<{ readonly issues: readonly Issue[] }>
  [IssueKind.InvalidReturnType]: MakeIssue<{
    readonly issues: readonly Issue[]
  }>
  [IssueKind.InvalidUnion]: MakeIssue<{
    readonly unionIssues: readonly Issue[]
  }>
  [IssueKind.InvalidIntersection]: MakeIssue<null>
  [IssueKind.InvalidInstance]: MakeIssue<{
    readonly expected: { readonly className: string }
  }>
  [IssueKind.UnrecognizedKeys]: MakeIssue<{ readonly keys: readonly string[] }>
  [IssueKind.Forbidden]: MakeIssue<null>
  [IssueKind.Custom]: MakeIssue<{
    readonly message?: string
    readonly params?: unknown
  }>
} extends infer X
  ? { [K in keyof X]: X[K] & { readonly kind: K | `${K & string}` } }
  : never

export type Issue<K extends IssueKind = IssueKind> = IssueMap[K]
export type NoMsgIssue<K extends IssueKind = IssueKind> = K extends unknown
  ? Omit<Issue<K>, 'message'>
  : never

export namespace checks {
  export type Base<Kind extends string = string> = {
    readonly check: Kind
    readonly message: string | undefined
  }

  export type Make<
    Kind extends string,
    Payload extends Record<string, unknown> | null = null
  > = Base<Kind> & (Payload extends null ? unknown : Payload)

  export type ToRules<Check extends Base> = readonly Check[]

  export type Kind<Rules extends readonly Base[] | undefined> =
    Rules extends readonly { readonly check: infer K }[] ? K : never

  export type GetByKind<
    Rules extends readonly Base[] | undefined,
    K extends string
  > = Rules extends readonly (infer Check)[]
    ? Extract<Check, { readonly check: K }>
    : never

  export type Min<V = number> = Make<
    'min',
    { readonly value: V; readonly inclusive: boolean }
  >

  export type Max<V = number> = Make<
    'max',
    { readonly value: V; readonly inclusive: boolean }
  >

  export type Range<V = number> = Make<
    'range',
    {
      readonly min: V
      readonly max: V
      readonly inclusive: 'min' | 'max' | 'both' | 'none'
    }
  >

  export type Length<V = number> = Make<'len', { readonly value: V }>

  export type Size<V = number> = Make<'size', { readonly value: V }>

  export type Sort<D extends 'ascending' | 'descending'> = Make<
    `sort_${D}`,
    { readonly direction: D; readonly convert: boolean }
  >
}
