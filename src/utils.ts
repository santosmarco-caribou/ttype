/* eslint-disable @typescript-eslint/ban-types */

import _cloneDeep from 'clone-deep'
import { createColors } from 'colorette'
import _dayjs from 'dayjs'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import { isPlainObject } from 'is-plain-object'
import _mergeDeep from 'merge-deep'
import _memoize from 'micro-memoize'
import safeJsonStringify from 'safe-json-stringify'
import type { F, N } from 'ts-toolbelt'
import type { NonNegativeInteger } from 'type-fest'
import { AnyTType, CreateOptions, TType } from './types'

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
  export type Or<T extends readonly [0 | 1, 0 | 1, ...(0 | 1)[]]> = 1 extends T[number] ? 1 : 0
  export type Defined<T> = T extends undefined ? never : T
  export type Simplify<T> = T extends _internals.BuiltIn | AnyTType ? T : { 0: { [K in keyof T]: Simplify<T[K]> }; 1: T }[Equals<T, unknown>]
  export type Literalized<T extends Primitive = Primitive> = T extends string ? `"${T}"` : T extends number | boolean | null | undefined ? `${T}` : T extends bigint ? `${T}n` : 'symbol'
  export type Join<T extends readonly unknown[], D extends string> = T extends readonly []
    ? ''
    : T extends readonly [string | number | bigint | boolean | null | undefined]
    ? `${T[0]}`
    : T extends readonly [string | number | bigint | boolean | null | undefined, ...infer Rest extends readonly unknown[]]
    ? `${T[0]}${D}${Join<Rest, D>}`
    : string
  export type ReplaceAll<T, From extends string, To extends string> = T extends `${infer A}${From}${infer B}` ? `${A}${To}${ReplaceAll<B, From, To>}` : T
  export type Values<T> = T[keyof T]
  export type Entries<T> = Simplify<{ [K in keyof T]: [K, T[K]] }[keyof T][]>
  export type FromEntries<T extends readonly [key: PropertyKey, value: unknown]> = Simplify<{ [K in T[0]]: Extract<T, [K, unknown]>[1] }>
  export type OptionalKeys<T> = { [K in keyof T]: undefined extends T[K] ? K : never }[keyof T]
  export type RequiredKeys<T> = { [K in keyof T]: undefined extends T[K] ? never : K }[keyof T]
  export type EnforceOptional<T> = Partial<Pick<T, OptionalKeys<T>>> & Pick<T, RequiredKeys<T>>
  export type Diff<A, B> = Omit<A, keyof B> & Omit<B, keyof A>
  export type Merge<A, B> = Omit<A, keyof B> & B
  export type OmitIndexSignature<T> = { [K in keyof T as {} extends Record<K, unknown> ? never : K]: T[K] }
  export type PickIndexSignature<T> = { [K in keyof T as {} extends Record<K, unknown> ? K : never]: T[K] }
  export type FixEmptyObject<T> = { 0: T; 1: Record<string, never> }[Equals<T, {}>]
  export type LiteralUnion<T, U extends Primitive> = T | (U & Record<never, never>)
  export type UnionToIntersection<T> = (T extends unknown ? (x: T) => void : never) extends (i: infer I) => void ? I : never
  export type GetLastOfUnion<T> = ((T extends unknown ? (x: () => T) => void : never) extends (i: infer I) => void ? I : never) extends () => infer Last ? Last : never
  export type CastToArray<T> = T extends readonly unknown[] ? T : never
  export type AtLeastOne<T> = readonly [T, ...T[]] | ({ readonly 0: T } & ReadonlyArray<T>)
  export type ConstructTuple<T, L extends number> = _internals.ConstructTuple<T, L>
  export type PartialTuple<T> = T extends readonly [] ? T : T extends readonly [infer H, ...infer R] ? [H?, ...PartialTuple<R>] : never
  export type EnforcePartialTuple<T> = T extends readonly [] ? [] : T extends readonly [infer H, ...infer R] ? [...(undefined extends H ? [H?] : [H]), ...EnforcePartialTuple<R>] : T
  export type UnionToTuple<T> = _internals.UnionToTuple<T>
  export type Reverse<T extends readonly unknown[]> = T extends readonly [] ? T : T extends readonly [...infer U, infer L] ? [L, ...Reverse<U>] : never
  export type Head<T extends readonly unknown[]> = T extends readonly [infer H, ...unknown[]] ? H : never
  export type Tail<T extends readonly unknown[]> = T extends readonly [unknown, ...infer R] ? R : []
  export type Last<T extends readonly unknown[]> = Head<Reverse<T>>
  declare const BRAND: unique symbol
  export type Branded<T, B> = T & { readonly [BRAND]: B }
  declare const TYPE_ERROR: unique symbol
  export type $TypeError<Msg extends string> = { [TYPE_ERROR]: Msg }
  export type $Validation<Condition extends 0 | 1, Msg extends string> = { 0: []; 1: [ERROR: $TypeError<Msg>] }[Condition]
  export type $ValidateNonNegativeInteger<T extends number> = $Validation<Equals<NonNegativeInteger<T>, never>, `Input value must be a non-negative integer; got ${T}`>
  export type $ValidateAgainstNumeric<T extends { value: number; label?: string }, Sign extends '<' | '<=' | '>' | '>=', U extends { value: number; label?: string }> = $Validation<
    { '<': N.GreaterEq<T['value'], U['value']>; '<=': N.Greater<T['value'], U['value']>; '>': N.LowerEq<T['value'], U['value']>; '>=': N.Lower<T['value'], U['value']> }[Sign],
    `${T['label'] extends string ? `"${T['label']}"` : 'Input value'} must be ${Sign} ${U['label'] extends string ? `"${U['label']}" (${U['value']})` : U['value']}; got ${T['value']}`
  >

  /* ---------------------------------------------------------------- State --------------------------------------------------------------- */
  export type MinMaxState = { min: number; max: number }
  export type MinMaxInitialState = { min: 0; max: PositiveInfinity }
  export type ComputeNextMinMaxState<CurrState extends MinMaxState, Method extends keyof MinMaxState, Value extends number, Inclusive extends boolean> = Simplify<
    Merge<
      CurrState,
      { [K in Method]: { 0: Value; 1: { min: N.Add<Value, 1>; max: N.Sub<Value, 1> }[K] }[Equals<Inclusive, false>] } & {
        [K in Exclude<keyof MinMaxState, Method>]: { 0: CurrState[K]; 1: MinMaxInitialState[K] }[Equals<CurrState['min'], CurrState['max']>]
      }
    >
  >
  export type $ValidateMinMax<CurrState extends MinMaxState, Method extends keyof MinMaxState, Value extends number, Inclusive extends boolean> = [
    ...$ValidateNonNegativeInteger<{ 0: Value; 1: { min: N.Add<Value, 1>; max: N.Sub<Value, 1> }[Method] }[Equals<Inclusive, false>]>,
    ...{
      0: $ValidateAgainstNumeric<
        { value: { 0: Value; 1: { min: N.Add<Value, 1>; max: N.Sub<Value, 1> }[Method] }[Equals<Inclusive, false>]; label: Method },
        { min: '<='; max: '>=' }[Method],
        { value: CurrState[Exclude<keyof MinMaxState, Method>]; label: Exclude<keyof MinMaxState, Method> }
      >
      1: []
    }[Or<[Equals<CurrState[Method], CurrState[Exclude<keyof MinMaxState, Method>]>, Equals<CurrState[Exclude<keyof MinMaxState, Method>], { min: PositiveInfinity; max: 0 }[Method]>]>]
  ]

  /* ------------------------------------------------------------- Type guards ------------------------------------------------------------ */
  export const isObject = (value: unknown): value is Record<string, unknown> => isPlainObject(value)
  export const isPrimitive = (value: unknown): value is Primitive => value === null || ['string', 'number', 'bigint', 'boolean', 'symbol', 'undefined'].includes(typeof value)
  export const isDefined = <T>(value: T): value is Defined<T> => value !== undefined
  export const isArray = <T>(value: T): value is Extract<T, readonly unknown[]> => Array.isArray(value)

  /* --------------------------------------------------------------- Strings -------------------------------------------------------------- */
  export const literalize = <T extends Primitive>(value: T): Literalized<T> => {
    return ((): string => {
      if (typeof value === 'string') return `"${value}"`
      if (typeof value === 'number' || typeof value === 'boolean') return `${value}`
      if (value === undefined) return 'undefined'
      if (value === null) return 'null'
      if (typeof value === 'bigint') return `${value}n`
      return 'symbol'
    })() as Literalized<T>
  }
  export const replaceAll = <T extends string, From extends string, To extends string>(str: T, from: From, to: To): ReplaceAll<T, From, To> => str.split(from).join(to) as ReplaceAll<T, From, To>
  export const pluralize = (word: string, count: number): string => `${word}${count < 0 ? '(s)' : count <= 1 ? '' : 's'}`
  export const intToLiteral = (int: number): string => (int === 0 ? 'zero' : int === 1 ? 'one' : `${int}`)
  export const jsonStringify = (value: object): string => safeJsonStringify(value, (_, val) => (typeof val === 'bigint' ? `${val}n` : typeof val === 'symbol' ? val.toString() : val), 2)

  /* --------------------------------------------------------------- Arrays --------------------------------------------------------------- */
  export const includes = <T>(arr: readonly T[], item: unknown): item is T => [item, ...arr].slice(1).includes(item)
  export const tail = <T extends readonly unknown[]>(arr: T): Tail<T> => arr.slice(1) as Tail<T>
  export const head = <T extends readonly unknown[]>(arr: T): Head<T> => arr[0] as Head<T>
  export const last = <T extends readonly unknown[]>(arr: T): Last<T> => arr[arr.length - 1] as Last<T>

  /* --------------------------------------------------------------- Objects -------------------------------------------------------------- */
  export type DeepCloned<T> = Branded<T, '__deepCloned'>
  export const cloneDeep = <T>(value: T): DeepCloned<T> => _cloneDeep(value) as DeepCloned<T>
  export const mergeDeep = _mergeDeep
  export const keys = <T extends object>(obj: T): readonly (keyof T)[] => Object.keys(obj) as (keyof T)[]
  export const entries = <T extends object>(obj: T): Entries<T> => Object.entries(obj) as Entries<T>
  export const values = <T extends object>(obj: T): readonly Values<T>[] => Object.values(obj) as Values<T>[]
  export const fromEntries = <K extends PropertyKey, T extends readonly [K, unknown][]>(entries: T): FromEntries<T[number]> => Object.fromEntries(entries) as FromEntries<T[number]>
  export const diff = <A extends object, B extends object>(a: A, b: B): Diff<A, B> => ({ ...omit(a, Object.keys(b) as (keyof A)[]), ...omit(b, Object.keys(a) as (keyof B)[]) } as Diff<A, B>)
  export const merge = <A extends object, B extends object>(a: A, b: B): Merge<A, B> => ({ ...cloneDeep(a), ...cloneDeep(b) } as Merge<A, B>)
  export const pick = <T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K> => Object.fromEntries(entries(obj).filter(([k]) => includes(keys, k))) as Pick<T, K>
  export const omit = <T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Omit<T, K> => Object.fromEntries(entries(obj).filter(([k]) => !includes(keys, k))) as Omit<T, K>
  export const simplify = <T>(value: T): Simplify<T> => value as Simplify<T>

  /* ---------------------------------------------------------------- Dates --------------------------------------------------------------- */
  _dayjs.extend(isSameOrBefore)
  _dayjs.extend(isSameOrAfter)
  _dayjs.extend(isBetween)
  export const dayjs = _dayjs

  /* -------------------------------------------------------------- Functions ------------------------------------------------------------- */
  export const memoize = _memoize
  export const ensureFlat = <T extends readonly unknown[]>(...args: T): T => (isArray(args[0]) ? args[0] : args)
  export const handleRestOrArrayArg = <T extends readonly unknown[]>(...args: T): [T, CreateOptions | T[number]] => {
    const arg = ensureFlat(...args)
    const maybeCreateOptions = last(args) as CreateOptions | T[number]
    return [arg, maybeCreateOptions]
  }
  export const ensureCreateOptions = (options: CreateOptions | AnyTType): CreateOptions | undefined => (options instanceof TType ? undefined : options)
  export const widen = <T>(value: F.Narrow<T>): T => value as T

  /* --------------------------------------------------------------- Colors --------------------------------------------------------------- */
  export const colors = createColors({ useColor: true })

  /* -------------------------------------------------------------- Constants ------------------------------------------------------------- */
  export const Constants = {
    patterns: {
      alphanum: /^[a-zA-Z\d]+$/,
      cuid: /^c[^\s-]{8,}$/i,
      data_uri: /^data:[\w+.-]+\/[\w+.-]+;((charset=[\w-]+|base64),)?(.*)$/,
      email: /^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/,
      hex: /^[a-f\d]+$/i,
      iso_date:
        /^(?:[-+]\d{2})?\d{4}(?!\d{2}\b)(?:(-?)(?:(?:0[1-9]|1[0-2])(?:\1(?:[12]\d|0[1-9]|3[01]))?|W(?:[0-4]\d|5[0-2])(?:-?[1-7])?|00[1-9]|0[1-9]\d|[12]\d{2}|3(?:[0-5]\d|6[1-6]))(?!T$|T\d+Z$)(?:[T\s](?:(?:[01]\d|2[0-3])(?:(:?)[0-5]\d)?|24:?00)(?:[.,]\d+(?!:))?(?:\2[0-5]\d(?:[.,]\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3])(?::?[0-5]\d)?)?)?)?$/,
      iso_duration: /^P(?!$)(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+S)?)?$/,
      uuid: /^([a-f\d]{8}-[a-f\d]{4}-[1-5][a-f\d]{3}-[a-f\d]{4}-[a-f\d]{12}|00000000-0000-0000-0000-000000000000)$/i,
    },
  } as const

  /* -------------------------------------------------------------- Internals ------------------------------------------------------------- */
  export namespace _internals {
    export type BuiltIn =
      | { readonly [Symbol.toStringTag]: string }
      | AnyFunction
      | Date
      | Error
      | Generator
      | Primitive
      | Promise<any>
      | ReadonlyArray<any>
      | ReadonlyMap<any, any>
      | ReadonlySet<any>
      | RegExp
    export type ConstructTuple<T, L extends number, _Acc extends readonly T[] = []> = _Acc extends { readonly length: L }
      ? _Acc
      : _Acc extends { readonly length: TUPLE_MAX_LENGTH }
      ? T[]
      : ConstructTuple<T, L, [..._Acc, T]>
    export type UnionToTuple<T, _Acc extends readonly unknown[] = []> = [T] extends [never] ? readonly [..._Acc] : UnionToTuple<Exclude<T, GetLastOfUnion<T>>, readonly [GetLastOfUnion<T>, ..._Acc]>
    export type BaseKeyFilter<T, K extends keyof T> = K extends symbol ? never : T[K] extends symbol ? never : [AnyFunction] extends [T[K]] ? never : K
  }
}
