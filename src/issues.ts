import type { TError } from './error'
import type { ParsePath, TParsedType } from './parse'
import type { TArrayCheck, TDateCheck, TSetCheck, TTupleCheck, TTypeName } from './types'
import type { utils } from './utils'

export enum IssueKind {
  Required = 'required',
  InvalidType = 'invalid_type',
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
  [IssueKind.InvalidArray]: MakeIssue<TArrayCheck>
  [IssueKind.InvalidDate]: MakeIssue<TDateCheck>
  [IssueKind.InvalidSet]: MakeIssue<TSetCheck>
  [IssueKind.InvalidTuple]: MakeIssue<TTupleCheck>
  [IssueKind.InvalidEnumValue]: MakeIssue<{
    readonly expected: { readonly values: readonly (string | number)[]; readonly formatted: string }
    readonly received: { readonly value: string | number; readonly formatted: string }
  }>
  [IssueKind.InvalidLiteral]: MakeIssue<{
    readonly expected: { readonly value: utils.Primitive; readonly formatted: string }
    readonly received: { readonly value: utils.Primitive; readonly formatted: string }
  }>
  [IssueKind.InvalidArguments]: MakeIssue<{
    readonly error: TError
  }>
  [IssueKind.InvalidReturnType]: MakeIssue<{
    readonly error: TError
  }>
  [IssueKind.InvalidUnion]: MakeIssue<{
    readonly unionIssues: readonly Issue[]
  }>
  [IssueKind.InvalidIntersection]: MakeIssue<null>
  [IssueKind.InvalidInstance]: MakeIssue<{
    readonly expected: { readonly className: string }
  }>
  [IssueKind.UnrecognizedKeys]: MakeIssue<{
    readonly keys: readonly string[]
  }>
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
  type Construct<C extends string, T extends Record<string, unknown>> = {
    readonly check: C
    readonly message: string | undefined
  } & T

  type MinMax<T extends 'min' | 'max', V = number> = Construct<
    T,
    { readonly value: V; readonly inclusive: boolean }
  >
  export type Min<V = number> = MinMax<'min', V>
  export type Max<V = number> = MinMax<'max', V>

  export type Range<V = number> = Construct<
    'range',
    { readonly min: V; readonly max: V; readonly inclusive: 'min' | 'max' | 'both' | 'none' }
  >

  type LenSize<T extends 'len' | 'size', V = number> = Construct<T, { readonly value: V }>
  export type Length<V = number> = LenSize<'len', V>
  export type Size<V = number> = LenSize<'size', V>

  type Sort<T extends 'ascending' | 'descending'> = Construct<
    `sort_${T}`,
    { readonly direction: T; readonly convert: boolean }
  >
  export type SortAscending = Sort<'ascending'>
  export type SortDescending = Sort<'descending'>
}
