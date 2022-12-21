import {
  TTypeName,
  type AnyTType,
  type EnumValues,
  type TObjectCatchall,
  type TObjectShape,
  type TObjectUnknownKeys,
  type TTupleItems,
  type TTupleRest,
} from './types'
import { utils } from './utils'

type GetHint<T> = T extends { readonly hint: infer H extends string }
  ? H
  : never

export type TEnumHint<T extends EnumValues> = utils.Join<
  { [K in keyof T]: utils.Literalized<T[K]> },
  ' | '
>

const showEnum = <T extends EnumValues>(values: T): TEnumHint<T> =>
  values.map(utils.literalize).join(' | ') as TEnumHint<T>

export type TArrayHint<T extends AnyTType> = T extends {
  readonly typeName:
    | TTypeName.Tuple
    | TTypeName.Enum
    | TTypeName.Union
    | TTypeName.Optional
    | TTypeName.Nullable
}
  ? `(${GetHint<T>})[]`
  : `${GetHint<T>}[]`

const showArray = <T extends AnyTType>(element: T): TArrayHint<T> => {
  const shouldParens = element.isType(
    TTypeName.Tuple,
    TTypeName.Enum,
    TTypeName.Union,
    TTypeName.Optional,
    TTypeName.Nullable
  )
  return `${shouldParens ? '(' : ''}${element.hint}${
    shouldParens ? ')' : ''
  }[]` as TArrayHint<T>
}

export type TTupleHint<
  T extends TTupleItems,
  R extends TTupleRest | null
> = `readonly [${utils.Join<
  utils.CastToArray<{ [K in keyof T]: GetHint<T[K]> }>,
  ', '
>}${R extends TTupleRest ? `, ...${TArrayHint<R>}` : ''}]`

const showTuple = <T extends TTupleItems, R extends TTupleRest | null>(
  items: T,
  restType: R
): TTupleHint<T, R> =>
  `readonly [${items.map((i) => i.hint).join(', ')}${
    restType ? `, ...${show.array(restType)}` : ''
  }]` as TTupleHint<T, R>

type ObjectValues<T> = utils.UnionToTuple<keyof T> extends infer Keys
  ? utils.CastToArray<{
      [K in keyof Keys]: Keys[K] extends keyof T ? T[Keys[K]] : never
    }>
  : never

type AddObjectIntersection<T extends string> = ` & { [x: string]: ${T} }`

export type TObjectHint<
  S extends TObjectShape,
  UK extends TObjectUnknownKeys | null,
  C extends TObjectCatchall | null
> = `{ ${utils.Join<
  ObjectValues<{
    [K in keyof S]: `${K & string}${undefined extends S[K]['_O']
      ? '?'
      : ''}: ${GetHint<S[K]>}`
  }>,
  ', '
>} }${C extends TObjectCatchall
  ? AddObjectIntersection<GetHint<C>>
  : UK extends 'passthrough'
  ? AddObjectIntersection<'unknown'>
  : UK extends 'strict'
  ? AddObjectIntersection<'never'>
  : ''}`

const showObject = <
  S extends TObjectShape,
  UK extends TObjectUnknownKeys | null,
  C extends TObjectCatchall | null
>(
  shape: S,
  unknownKeys: UK,
  catchall: C
): TObjectHint<S, UK, C> =>
  `{ ${Object.entries(shape)
    .map(([k, v]) => `${k}${v.isOptional() ? '?' : ''}: ${v.hint}`)
    .join(', ')} }${
    catchall || utils.includes(['passthrough', 'strict'], unknownKeys)
      ? ` & { [x: string]: ${
          catchall?.hint ??
          (unknownKeys === 'passthrough' ? 'unknown' : 'never')
        } }`
      : ''
  }` as TObjectHint<S, UK, C>

export const show = {
  enum: showEnum,
  array: showArray,
  tuple: showTuple,
  object: showObject,
}
