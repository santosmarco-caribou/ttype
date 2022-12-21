import _cloneDeep from 'clone-deep'
import _dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { isPlainObject } from 'is-plain-object'
import _mergeDeep from 'merge-deep'
import _memoize from 'micro-memoize'
import type { N } from 'ts-toolbelt'
import type { NonNegativeInteger } from 'type-fest'
import type { AnyTType } from './types'

export namespace utils {
  /* ---------------------------------------------------------------- Types --------------------------------------------------------------- */
  export const UNSET_MARKER = Symbol('UNSET_MARKER')
  export type UNSET_MARKER = typeof UNSET_MARKER
  export type TUPLE_MAX_LENGTH = 600
  // eslint-disable-next-line @typescript-eslint/no-loss-of-precision
  export type PositiveInfinity = 1e999
  export type Primitive = string | number | bigint | boolean | symbol | null | undefined
  export type Class = abstract new (...args: readonly any[]) => any
  export type AnyFunction = ((...args: readonly any[]) => any) | Class
  export type Equals<T, U> = (<X>() => X extends T ? 1 : 0) extends <Y>() => Y extends U ? 1 : 0 ? 1 : 0
  export type Defined<T> = T extends undefined ? never : T
  export type Simplify<T> = T extends _internals.BuiltIn | AnyTType ? T : { 0: { [K in keyof T]: Simplify<T[K]> }; 1: T }[Equals<T, unknown>]
  export type Literalized<T extends Primitive = Primitive> = T extends string ? `"${T}"` : T extends number | boolean | null | undefined ? `${T}` : T extends bigint ? `${T}n` : 'symbol'
  export type RequiredFilter<T, K extends keyof T> = undefined extends T[K] ? (T[K] extends undefined ? K : never) : K
  export type OptionalFilter<T, K extends keyof T> = undefined extends T[K] ? (T[K] extends undefined ? never : K) : never
  export type EnforceOptional<T> = { [K in keyof T as RequiredFilter<T, K>]: T[K] } & { [K in keyof T as OptionalFilter<T, K>]?: Exclude<T[K], undefined> }
  export type Merge<A, B> = Omit<A, keyof B> & B
  // eslint-disable-next-line @typescript-eslint/ban-types
  export type OmitIndexSignature<T> = { [K in keyof T as {} extends Record<K, unknown> ? never : K]: T[K] }
  export type LiteralUnion<T, U extends Primitive> = T | (U & Record<never, never>)
  export type UnionToIntersection<T> = (T extends unknown ? (x: T) => void : never) extends (i: infer I) => void ? I : never
  export type GetLastOfUnion<T> = ((T extends unknown ? (x: () => T) => void : never) extends (i: infer I) => void ? I : never) extends () => infer Last ? Last : never
  export type ConstructTuple<T, L extends number> = _internals.ConstructTuple<T, L>
  export type PartialTuple<T> = T extends readonly [] ? T : T extends readonly [infer H, ...infer R] ? [H?, ...PartialTuple<R>] : never
  export type UnionToTuple<T> = _internals.UnionToTuple<T>
  export type Tail<T> = T extends readonly [unknown, ...infer U] ? U : []
  declare const TYPE_ERROR: unique symbol
  export type $TypeError<Msg extends string> = { [TYPE_ERROR]: Msg }
  export type $Validation<Condition extends 0 | 1, Msg extends string> = { 0: []; 1: [ERROR: $TypeError<Msg>] }[Condition]
  export type $ValidateNonNegativeInteger<T extends number> = $Validation<Equals<NonNegativeInteger<T>, never>, `Input value must be a non-negative integer; got ${T}`>
  export type $ValidateAgainstNumeric<T extends { value: number; label?: string }, Sign extends '<' | '<=' | '>' | '>=', U extends { value: number; label?: string }> = $Validation<
    { '<': N.GreaterEq<T['value'], U['value']>; '<=': N.Greater<T['value'], U['value']>; '>': N.LowerEq<T['value'], U['value']>; '>=': N.Lower<T['value'], U['value']> }[Sign],
    `${T['label'] extends string ? `"${T['label']}"` : 'Input value'} must be ${Sign} ${U['label'] extends string ? `"${U['label']}" (${U['value']})` : U['value']}; got ${T['value']}`
  >

  /* ------------------------------------------------------------- Type guards ------------------------------------------------------------ */
  export const isObject = (value: unknown): value is Record<string, unknown> => isPlainObject(value)
  export const isPrimitive = (value: unknown): value is Primitive => value === null || ['string', 'number', 'bigint', 'boolean', 'symbol', 'undefined'].includes(typeof value)

  /* --------------------------------------------------------------- Strings -------------------------------------------------------------- */
  export const literalize = <T extends Primitive>(value: T) => {
    return (() => {
      if (typeof value === 'string') return `"${value}"`
      if (typeof value === 'number' || typeof value === 'boolean') return `${value}`
      if (value === undefined) return 'undefined'
      if (value === null) return 'null'
      if (typeof value === 'bigint') return `${value}n`
      return 'symbol'
    })() as Literalized<T>
  }

  /* --------------------------------------------------------------- Arrays --------------------------------------------------------------- */
  export const includes = <T>(arr: readonly T[], item: unknown): item is T => [item, ...arr].slice(1).includes(item)
  export const tail = <T extends readonly unknown[]>(arr: T) => arr.slice(1) as Tail<T>

  /* --------------------------------------------------------------- Objects -------------------------------------------------------------- */
  export const cloneDeep = _cloneDeep
  export const mergeDeep = _mergeDeep
  export const merge = <A, B>(a: A, b: B) => ({ ...cloneDeep(a), ...cloneDeep(b) } as Merge<A, B>)
  export const pick = <T extends object, K extends keyof T>(object: T, keys: readonly K[]) => Object.fromEntries(Object.entries(object).filter(([key]) => includes(keys, key))) as Pick<T, K>
  export const omit = <T extends object, K extends keyof T>(object: T, keys: readonly K[]) => Object.fromEntries(Object.entries(object).filter(([key]) => !includes(keys, key))) as Omit<T, K>

  /* ---------------------------------------------------------------- Dates --------------------------------------------------------------- */
  _dayjs.extend(isSameOrBefore)
  _dayjs.extend(isSameOrAfter)
  _dayjs.extend(isBetween)
  export const dayjs = _dayjs

  /* -------------------------------------------------------------- Functions ------------------------------------------------------------- */
  export const memoize = _memoize

  /* -------------------------------------------------------------- Internals ------------------------------------------------------------- */
  namespace _internals {
    export type BuiltIn =
      | { readonly [Symbol.toStringTag]: string }
      | AnyFunction
      | Date
      | Error
      | Generator
      | Promise<unknown>
      | ReadonlyArray<unknown>
      | ReadonlyMap<unknown, unknown>
      | ReadonlySet<unknown>
      | RegExp
    export type ConstructTuple<T, L extends number, _Acc extends readonly T[] = []> = _Acc extends { readonly length: L }
      ? _Acc
      : _Acc extends { readonly length: TUPLE_MAX_LENGTH }
      ? T[]
      : ConstructTuple<T, L, [..._Acc, T]>
    export type UnionToTuple<T, _Acc extends readonly unknown[] = []> = [T] extends [never] ? readonly [..._Acc] : UnionToTuple<Exclude<T, GetLastOfUnion<T>>, readonly [GetLastOfUnion<T>, ..._Acc]>
  }
}
