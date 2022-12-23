import {
  TTypeName,
  flattenUnionMembers,
  type AnyTObject,
  type AnyTType,
  type AnyTUnion,
  TObjectShape,
} from './types'
import { utils } from './utils'

const object = <S extends TObjectShape>(instance: AnyTObject<S>): string => {
  const {
    _def: { shape, unknownKeys, catchall },
  } = instance

  const needsParens =
    catchall || utils.includes(['passthrough', 'strict'], unknownKeys)

  const hint = `{ ${Object.entries(shape)
    .map(([k, v]) => `${k}${v.isOptional() ? '?' : ''}: ${v.hint}`)
    .join(', ')} }${
    catchall || utils.includes(['passthrough', 'strict'], unknownKeys)
      ? ` & { [x: string]: ${
          catchall?.hint ??
          (unknownKeys === 'passthrough' ? THint.Unknown : THint.Never)
        } }`
      : ''
  }`

  return needsParens ? `(${hint})` : hint
}

const union = (instance: AnyTUnion): string => {
  const members = flattenUnionMembers(instance)

  const hintsToAdd = new Set<string>()

  const withoutNevers = members.filter((m) => !m.isType(TTypeName.Never))
  if (withoutNevers.length === 0) return THint.Never

  const withoutNullishs = withoutNevers.filter(function filterNullish(
    m: AnyTType
  ): AnyTType {
    if (m.isType(TTypeName.Optional, TTypeName.Nullable)) {
      hintsToAdd.add(
        {
          [TTypeName.Optional]: THint.Undefined,
          [TTypeName.Nullable]: THint.Null,
        }[m.typeName]
      )
      return filterNullish(m.unwrapDeep())
    } else {
      return m
    }
  })

  let filtered: AnyTType[] = withoutNullishs

  const hintDoesNotMatch = (pattern: RegExp) => (member: AnyTType) =>
    !member.hint.match(pattern)

  for (const member of filtered) {
    if (member.isType(TTypeName.Any)) return THint.Any
    if (member.isType(TTypeName.Unknown)) return THint.Unknown

    if (member.isType(TTypeName.Boolean)) {
      filtered = filtered.filter(hintDoesNotMatch(/^(?:true|false)$/))
      continue
    }

    if (member.isType(TTypeName.String)) {
      filtered = filtered.filter(hintDoesNotMatch(/^('|").*\1$/))
      continue
    }

    if (member.isType(TTypeName.Number)) {
      filtered = filtered.filter(hintDoesNotMatch(/^-?\d+(?:\.\d+)?$/))
      continue
    }

    if (member.isType(TTypeName.BigInt)) {
      filtered = filtered.filter(hintDoesNotMatch(/^-?\d+n$/))
      continue
    }
  }

  const unionized = [
    ...new Set(filtered.map((m) => m.hint).concat(...hintsToAdd.values())),
  ]

  return unionized.join(' | ')
}

export const THint = {
  Any: 'any',
  BigInt: 'bigint',
  Boolean: 'boolean',
  Buffer: 'Buffer',
  Date: 'Date',
  False: 'false',
  NaN: 'NaN',
  Never: 'never',
  Null: 'null',
  Number: 'number',
  String: 'string',
  Symbol: 'symbol',
  True: 'true',
  Undefined: 'undefined',
  Unknown: 'unknown',
  Void: 'void',
  Object: object,
  Union: union,
} as const
