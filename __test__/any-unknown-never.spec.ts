import t from '../src'
import { assertEqual } from './_utils'

describe('TAny', () => {
  const Any = t.any()
  const OptionalAny = t.any().optional()
  const NullableAny = t.any().nullable()

  test('passes', () => {
    expect(Any.safeParse('John').ok).toBe(true)
    expect(Any.safeParse(1).ok).toBe(true)
    expect(Any.safeParse(true).ok).toBe(true)
    expect(Any.safeParse(null).ok).toBe(true)
    expect(Any.safeParse(undefined).ok).toBe(true)
    expect(Any.safeParse({}).ok).toBe(true)
    expect(Any.safeParse([]).ok).toBe(true)
    expect(Any.safeParse(new Date()).ok).toBe(true)
    expect(Any.safeParse(BigInt(1)).ok).toBe(true)
    expect(Any.safeParse(Symbol('foo')).ok).toBe(true)
  })

  test('inference', () => {
    assertEqual<t.infer<typeof Any>, any>(true)
    assertEqual<t.infer<typeof OptionalAny>, any>(true)
    assertEqual<t.infer<typeof NullableAny>, any>(true)
  })
})

describe('TUnknown', () => {
  const Unknown = t.unknown()
  const OptionalUnknown = t.unknown().optional()
  const NullableUnknown = t.unknown().nullable()

  test('passes', () => {
    expect(Unknown.safeParse('John').ok).toBe(true)
    expect(Unknown.safeParse(1).ok).toBe(true)
    expect(Unknown.safeParse(true).ok).toBe(true)
    expect(Unknown.safeParse(null).ok).toBe(true)
    expect(Unknown.safeParse(undefined).ok).toBe(true)
    expect(Unknown.safeParse({}).ok).toBe(true)
    expect(Unknown.safeParse([]).ok).toBe(true)
    expect(Unknown.safeParse(new Date()).ok).toBe(true)
    expect(Unknown.safeParse(BigInt(1)).ok).toBe(true)
    expect(Unknown.safeParse(Symbol('foo')).ok).toBe(true)
  })

  test('inference', () => {
    assertEqual<t.infer<typeof Unknown>, unknown>(true)
    assertEqual<t.infer<typeof OptionalUnknown>, unknown>(true)
    assertEqual<t.infer<typeof NullableUnknown>, unknown>(true)
  })
})

describe('TNever', () => {
  const Never = t.never()
  const OptionalNever = t.never().optional()
  const NullableNever = t.never().nullable()
  const NullishNever = t.never().nullish()

  test('passes', () => {
    expect(OptionalNever.parse(undefined)).toBe(undefined)
    expect(NullableNever.parse(null)).toBe(null)
    expect(NullishNever.parse(undefined)).toBe(undefined)
    expect(NullishNever.parse(null)).toBe(null)
  })

  test('fails', () => {
    expect(Never.safeParse('John').error?.issues).toHaveLength(1)
    expect(Never.safeParse('John').error?.issues[0].kind).toBe('forbidden')
    expect(Never.safeParse(1).error?.issues).toHaveLength(1)
    expect(Never.safeParse(1).error?.issues[0].kind).toBe('forbidden')
    expect(Never.safeParse(true).error?.issues).toHaveLength(1)
    expect(Never.safeParse(true).error?.issues[0].kind).toBe('forbidden')
    expect(Never.safeParse(null).error?.issues).toHaveLength(1)
    expect(Never.safeParse(null).error?.issues[0].kind).toBe('forbidden')
    expect(Never.safeParse(undefined).error?.issues).toHaveLength(1)
    expect(Never.safeParse(undefined).error?.issues[0].kind).toBe('forbidden')
    expect(Never.safeParse({}).error?.issues).toHaveLength(1)
    expect(Never.safeParse({}).error?.issues[0].kind).toBe('forbidden')
    expect(Never.safeParse([]).error?.issues).toHaveLength(1)
    expect(Never.safeParse([]).error?.issues[0].kind).toBe('forbidden')
    expect(Never.safeParse(new Date()).error?.issues).toHaveLength(1)
    expect(Never.safeParse(new Date()).error?.issues[0].kind).toBe('forbidden')
    expect(Never.safeParse(BigInt(1)).error?.issues).toHaveLength(1)
    expect(Never.safeParse(BigInt(1)).error?.issues[0].kind).toBe('forbidden')
    expect(Never.safeParse(Symbol('foo')).error?.issues).toHaveLength(1)
    expect(Never.safeParse(Symbol('foo')).error?.issues[0].kind).toBe(
      'forbidden'
    )
  })

  test('inference', () => {
    assertEqual<t.infer<typeof Never>, never>(true)
    assertEqual<t.infer<typeof OptionalNever>, undefined>(true)
    assertEqual<t.infer<typeof NullableNever>, null>(true)
    assertEqual<t.infer<typeof NullishNever>, null | undefined>(true)
  })
})
