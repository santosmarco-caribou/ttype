import type { Primitive } from 'type-fest'
import type { TError } from './error'
import type { ParsePath, TParsedType } from './parse'
import type { TArrayCheck, TDateCheck, TTypeName } from './types'

export enum IssueKind {
  Required = 'required',
  InvalidType = 'invalid_type',
  InvalidArray = 'invalid_array',
  InvalidDate = 'invalid_date',
  InvalidEnumValue = 'invalid_enum_value',
  InvalidLiteral = 'invalid_literal',
  InvalidUnion = 'invalid_union',
  InvalidInstance = 'invalid_instance',
  UnrecognizedKeys = 'unrecognized_keys',
  Forbidden = 'forbidden',
  Custom = 'custom',
}

export type IssuePayload = Record<string, unknown> | null

export interface IssueInput {
  readonly data: unknown
  readonly type: TParsedType
}

type MakeIssue<P extends IssuePayload> = {
  readonly input: IssueInput
  readonly path: ParsePath
  readonly message: string
  readonly typeName: TTypeName
  readonly typeHint: string
} & (P extends null ? unknown : { readonly payload: P })

export type IssueMap = {
  [IssueKind.Required]: MakeIssue<null>
  [IssueKind.InvalidType]: MakeIssue<{
    readonly expected: TParsedType
    readonly received: TParsedType
  }>
  [IssueKind.InvalidArray]: MakeIssue<TArrayCheck>
  [IssueKind.InvalidDate]: MakeIssue<TDateCheck>
  [IssueKind.InvalidEnumValue]: MakeIssue<{
    readonly expected: { readonly values: readonly (string | number)[]; readonly formatted: string }
    readonly received: { readonly value: string | number; readonly formatted: string }
  }>
  [IssueKind.InvalidLiteral]: MakeIssue<{
    readonly expected: { readonly value: Primitive; readonly formatted: string }
    readonly received: { readonly value: Primitive; readonly formatted: string }
  }>
  [IssueKind.InvalidUnion]: MakeIssue<{
    readonly unionErrors: readonly TError[]
  }>
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
  ? { [K in keyof X]: X[K] & { readonly kind: K } }
  : never

export type Issue<K extends IssueKind = IssueKind> = IssueMap[K]

export namespace checks {
  type MinMax<T extends 'min' | 'max', V = number> = {
    readonly kind: T
    readonly value: V
    readonly inclusive: boolean
  }
  export type Min<V = number> = MinMax<'min', V>
  export type Max<V = number> = MinMax<'max', V>

  export type Range<V = number> = {
    readonly kind: 'range'
    readonly min: V
    readonly max: V
    readonly inclusive: 'min' | 'max' | 'both' | 'none'
  }

  type LengthSize<T extends 'length' | 'size', V = number> = {
    readonly kind: T
    readonly value: V
  }
  export type Length<V = number> = LengthSize<'length', V>
  export type Size<V = number> = LengthSize<'size', V>

  type Sorting<T extends 'ascending' | 'descending'> = {
    readonly kind: `sort_${T}`
    readonly direction: T
    readonly convert: boolean
  }
  export type SortAscending = Sorting<'ascending'>
  export type SortDescending = Sorting<'descending'>
}
