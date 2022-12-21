import t from '../src'
import { assertEqual } from './_utils'

describe('TArray', () => {
  test('passes', () => {
    expect(t.array(t.any()).safeParse(['John']).ok).toBe(true)
    expect(
      t.array(t.bigint()).safeParse([BigInt(1), BigInt(2), BigInt(3)]).ok
    ).toBe(true)
    expect(t.array(t.boolean()).safeParse([true, false]).ok).toBe(true)
    expect(t.boolean().array().safeParse([true, false]).ok).toBe(true)
  })

  test('fails', () => {
    expect(() => t.array(t.any()).parse('John')).toThrow()
    expect(() => t.array(t.bigint()).parse([1, 2, 3])).toThrow()
    expect(() => t.array(t.boolean()).parse(['true'])).toThrow()
  })

  describe('checks', () => {
    test('min', () => {
      expect(
        t
          .array(t.bigint())
          .min(2)
          .safeParse([BigInt(1), BigInt(2), BigInt(3)]).ok
      ).toBe(true)
      expect(() =>
        t.array(t.bigint()).min(0, { inclusive: false }).parse([])
      ).toThrow()
    })

    test('max', () => {
      expect(t.array(t.boolean()).max(2).safeParse([true, false]).ok).toBe(true)
      expect(() =>
        t.array(t.boolean()).max(2, { inclusive: false }).parse([true, false])
      ).toThrow()
    })

    test('length', () => {
      expect(t.array(t.boolean()).length(2).safeParse([true, false]).ok).toBe(
        true
      )
      expect(() =>
        t
          .array(t.bigint())
          .length(2)
          .parse([BigInt(1)])
      ).toThrow()
      expect(() =>
        t
          .array(t.bigint())
          .length(2)
          .parse([BigInt(1), BigInt(2), BigInt(3)])
      ).toThrow()
    })

    test.todo('sort asc')
    test.todo('sort desc')

    test('compile-time errors', () => {
      // @ts-expect-error Input value must be a non-negative integer; got -1
      t.array(t.bigint()).min(-1)
      // @ts-expect-error Input value must be a non-negative integer; got 1.2
      t.array(t.bigint()).min(1.2)
      // @ts-expect-error Input value must be a non-negative integer; got 1.2
      t.array(t.symbol()).max(1.2)
      // @ts-expect-error Input value must be a non-negative integer; got -1
      t.array(t.null()).max(0, { inclusive: false })
      // @ts-expect-error "min" must be <= "max" (10); got 12
      t.array(t.date()).max(10).min(12)
      // @ts-expect-error "max" must be >= "min" (12); got 10
      t.array(t.date()).min(12).max(10)
      // @ts-expect-error "min" must be <= "max" (10); got 11
      t.array(t.date()).max(10).min(10, { inclusive: false })
      // @ts-expect-error "max" must be >= "min" (10); got 9
      t.array(t.date()).min(10).max(10, { inclusive: false })
      // No errors
      t.array(t.date()).min(-1, { inclusive: false })
      t.array(t.date()).min(10).max(12)
      t.array(t.date()).max(12).min(10)
      t.array(t.date()).max(10).min(10)
      t.array(t.date()).max(10).min(9, { inclusive: false })
      t.array(t.date()).length(10).min(12)
      t.array(t.date()).length(10).max(8)
      t.array(t.date()).length(10).min(8).max(12)
      t.array(t.date()).length(10).min(8).max(12).length(12).length(24).min(16)
    })
  })

  test('flatten', () => {
    const flattened = t
      // 3 arrays
      .array(t.array(t.array(t.null())))
      .flatten()
      .flatten() // 2 flattens
    expect(flattened.element).toBeInstanceOf(t.TNull)
    assertEqual<t.infer<typeof flattened>, null[]>(true)
  })

  test('inference', () => {
    const anyArray = t.any().array()
    const unknownArray = t.unknown().array()
    const bigintArray = t.array(t.bigint())
    const doubleBooleanArray = t.array(t.array(t.boolean()))
    const nullArrayWithMaxLength = t.array(t.null()).max(5)
    const booleanArrayWithMinAndMaxLength = t.array(t.boolean()).min(5).max(12)
    const bigintArrayWithFixedLength = t.array(t.bigint()).length(12)
    const veryBigArray = t.array(t.null()).length(10_000)
    assertEqual<t.infer<typeof anyArray>, any[]>(true)
    assertEqual<t.infer<typeof unknownArray>, unknown[]>(true)
    assertEqual<t.infer<typeof bigintArray>, bigint[]>(true)
    assertEqual<t.infer<typeof doubleBooleanArray>, boolean[][]>(true)
    assertEqual<
      t.infer<typeof nullArrayWithMaxLength>,
      // All elements are optional since there was no `min`
      [null?, null?, null?, null?, null?, ...never[]]
    >(true)
    assertEqual<
      t.infer<typeof booleanArrayWithMinAndMaxLength>,
      [
        boolean,
        boolean,
        boolean,
        boolean,
        boolean, // min 5
        boolean?,
        boolean?,
        boolean?,
        boolean?,
        boolean?,
        boolean?,
        boolean?, // the rest are optional
        ...never[] // no more than 12
      ]
    >(true)
    assertEqual<
      t.infer<typeof bigintArrayWithFixedLength>,
      [
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        bigint,
        ...never[]
      ]
    >(true)
    assertEqual<t.infer<typeof veryBigArray>, null[]>(true)
  })
})

describe('TSet', () => {
  test('passes', () => {
    expect(t.set(t.any()).safeParse(new Set(['John'])).ok).toBe(true)
    expect(
      t.set(t.bigint()).safeParse(new Set([BigInt(1), BigInt(2), BigInt(3)])).ok
    ).toBe(true)
    expect(t.set(t.boolean()).safeParse(new Set([true, false])).ok).toBe(true)
  })

  test('fails', () => {
    expect(() => t.set(t.any()).parse('Michael')).toThrow()
    expect(() => t.set(t.bigint()).parse(new Set([1, 2, 3]))).toThrow()
    expect(() => t.set(t.boolean()).parse(new Set(['true']))).toThrow()
  })

  describe('checks', () => {
    test('min', () => {
      expect(
        t
          .set(t.bigint())
          .min(2)
          .safeParse(new Set([BigInt(1), BigInt(2), BigInt(3)])).ok
      ).toBe(true)
      expect(() =>
        t.set(t.bigint()).min(0, { inclusive: false }).parse(new Set([]))
      ).toThrow()
    })

    test('max', () => {
      expect(
        t
          .set(t.boolean())
          .max(2)
          .safeParse(new Set([true, false])).ok
      ).toBe(true)
      expect(() =>
        t
          .set(t.boolean())
          .max(2, { inclusive: false })
          .parse(new Set([true, false]))
      ).toThrow()
    })

    test('size', () => {
      expect(
        t
          .set(t.boolean())
          .size(2)
          .safeParse(new Set([true, false])).ok
      ).toBe(true)
      expect(() =>
        t
          .set(t.bigint())
          .size(2)
          .parse(new Set([BigInt(1)]))
      ).toThrow()
      expect(() =>
        t
          .set(t.bigint())
          .size(2)
          .parse(new Set([BigInt(1), BigInt(2), BigInt(3)]))
      ).toThrow()
    })

    test('compile-time errors', () => {
      // @ts-expect-error Input value must be a non-negative integer; got -1
      t.set(t.bigint()).min(-1)
      // @ts-expect-error Input value must be a non-negative integer; got 1.2
      t.set(t.bigint()).min(1.2)
      // @ts-expect-error Input value must be a non-negative integer; got 1.2
      t.set(t.symbol()).max(1.2)
      // @ts-expect-error Input value must be a non-negative integer; got -1
      t.set(t.null()).max(0, { inclusive: false })
      // @ts-expect-error "min" must be <= "max" (10); got 12
      t.set(t.date()).max(10).min(12)
      // @ts-expect-error "max" must be >= "min" (12); got 10
      t.set(t.date()).min(12).max(10)
      // @ts-expect-error "min" must be <= "max" (10); got 11
      t.set(t.date()).max(10).min(10, { inclusive: false })
      // @ts-expect-error "max" must be >= "min" (10); got 9
      t.set(t.date()).min(10).max(10, { inclusive: false })
      // No errors
      t.set(t.date()).min(-1, { inclusive: false })
      t.set(t.date()).min(10).max(12)
      t.set(t.date()).max(12).min(10)
      t.set(t.date()).max(10).min(10)
      t.set(t.date()).max(10).min(9, { inclusive: false })
      t.set(t.date()).size(10).min(12)
      t.set(t.date()).size(10).max(8)
      t.set(t.date()).size(10).min(8).max(12)
      t.set(t.date()).size(10).min(8).max(12).size(12).size(24).min(16)
    })
  })

  test('inference', () => {
    const bigintSet = t.set(t.bigint())
    const doubleBooleanSet = t.set(t.set(t.boolean()))
    assertEqual<t.infer<typeof bigintSet>, Set<bigint>>(true)
    assertEqual<t.infer<typeof doubleBooleanSet>, Set<Set<boolean>>>(true)
  })
})
