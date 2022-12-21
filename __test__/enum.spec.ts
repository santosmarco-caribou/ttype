import t from '../src'
import { assertEqual } from './_utils'

describe('TEnum', () => {
  const stringEnum = t.enum(['a', 'b', 'c'])
  const numberEnum = t.enum([1, 2, 3])
  const mixedEnum = t.enum(['a', 1, 'b', 2, 'c', 3])
  enum StringEnum {
    A = 'a',
    B = 'b',
    C = 'c',
  }
  enum NumberEnum {
    A,
    B,
    C,
  }
  const nativeStringEnum = t.enum(StringEnum)
  const nativeNumberEnum = t.enum(NumberEnum)

  test('hint', () => {
    expect(stringEnum.hint).toBe('"a" | "b" | "c"')
    expect(numberEnum.hint).toBe('1 | 2 | 3')
    expect(mixedEnum.hint).toBe('1 | 2 | 3 | "a" | "b" | "c"')
    expect(nativeStringEnum.hint).toBe('"a" | "b" | "c"')
    expect(nativeNumberEnum.hint).toBe('0 | 1 | 2')
  })

  describe('values/enum', () => {
    test('works', () => {
      expect(stringEnum.values).toStrictEqual(['a', 'b', 'c'])
      expect(numberEnum.values).toStrictEqual([1, 2, 3])
      expect(mixedEnum.values).toStrictEqual([1, 2, 3, 'a', 'b', 'c'])
      expect(nativeStringEnum.values).toStrictEqual(['a', 'b', 'c'])
      expect(nativeNumberEnum.values).toStrictEqual([0, 1, 2])
      expect(stringEnum.enum).toStrictEqual({ a: 'a', b: 'b', c: 'c' })
      expect(numberEnum.enum).toStrictEqual({ 1: 1, 2: 2, 3: 3 })
      expect(mixedEnum.enum).toStrictEqual({
        a: 'a',
        1: 1,
        b: 'b',
        2: 2,
        c: 'c',
        3: 3,
      })
      expect(nativeStringEnum.enum).toStrictEqual({
        A: StringEnum.A,
        B: StringEnum.B,
        C: StringEnum.C,
      })
      expect(nativeNumberEnum.enum).toStrictEqual({
        A: NumberEnum.A,
        B: NumberEnum.B,
        C: NumberEnum.C,
      })
      expect(nativeNumberEnum.enum).not.toStrictEqual(NumberEnum)
    })

    test('inference', () => {
      assertEqual<typeof stringEnum['values'], readonly ['a', 'b', 'c']>(true)
      assertEqual<typeof numberEnum['values'], readonly [3, 1, 2]>(true)
      assertEqual<
        typeof mixedEnum['values'],
        readonly ['a', 'b', 'c', 3, 1, 2]
      >(true)
      assertEqual<typeof nativeStringEnum['values'], readonly ['a', 'b', 'c']>(
        true
      )
      assertEqual<typeof nativeNumberEnum['values'], readonly [1, 2, 0]>(true)
      assertEqual<
        typeof stringEnum['enum'],
        { readonly a: 'a'; readonly b: 'b'; readonly c: 'c' }
      >(true)
      assertEqual<
        typeof numberEnum['enum'],
        { readonly 1: 1; readonly 2: 2; readonly 3: 3 }
      >(true)
      assertEqual<
        typeof mixedEnum['enum'],
        {
          readonly a: 'a'
          readonly 1: 1
          readonly b: 'b'
          readonly 2: 2
          readonly c: 'c'
          readonly 3: 3
        }
      >(true)
      assertEqual<
        typeof nativeStringEnum['enum'],
        { readonly A: 'a'; readonly B: 'b'; readonly C: 'c' }
      >(true)
      assertEqual<
        typeof nativeNumberEnum['enum'],
        { readonly A: 0; readonly B: 1; readonly C: 2 }
      >(true)
    })
  })

  describe('extract/exclude', () => {
    const foodEnum = t.enum(['apple', 'banana', 'orange'])
    const bananaOnly = foodEnum.extract('banana')
    const appleAndOrange = foodEnum.exclude(['banana'])
    enum FoodEnum {
      Apple = 'apple',
      Banana = 'banana',
      Orange = 'orange',
    }
    const nativeFoodEnum = t.enum(FoodEnum)
    const nativeBananaOnly = nativeFoodEnum.extract(FoodEnum.Banana)
    const nativeAppleAndOrange = nativeFoodEnum.exclude([FoodEnum.Banana])

    test('works', () => {
      expect(bananaOnly.values).toStrictEqual(['banana'])
      expect(appleAndOrange.values).toStrictEqual(['apple', 'orange'])
      expect(nativeBananaOnly.values).toStrictEqual(['banana'])
      expect(nativeAppleAndOrange.values).toStrictEqual(['apple', 'orange'])
      expect(bananaOnly.enum).toStrictEqual({ banana: 'banana' })
      expect(appleAndOrange.enum).toStrictEqual({
        apple: 'apple',
        orange: 'orange',
      })
      expect(nativeBananaOnly.enum).toStrictEqual({ Banana: FoodEnum.Banana })
      expect(nativeAppleAndOrange.enum).toStrictEqual({
        Apple: FoodEnum.Apple,
        Orange: FoodEnum.Orange,
      })
    })

    test('inference', () => {
      assertEqual<t.infer<typeof bananaOnly>, 'banana'>(true)
      assertEqual<t.infer<typeof appleAndOrange>, 'apple' | 'orange'>(true)
      assertEqual<t.infer<typeof nativeBananaOnly>, 'banana'>(true)
      assertEqual<t.infer<typeof nativeAppleAndOrange>, 'apple' | 'orange'>(
        true
      )
      assertEqual<typeof bananaOnly['values'], readonly ['banana']>(true)
      assertEqual<
        typeof appleAndOrange['values'],
        readonly ['apple', 'orange']
      >(true)
      assertEqual<typeof nativeBananaOnly['values'], readonly ['banana']>(true)
      assertEqual<
        typeof nativeAppleAndOrange['values'],
        readonly ['apple', 'orange']
      >(true)
      assertEqual<typeof bananaOnly['enum'], { readonly banana: 'banana' }>(
        true
      )
      assertEqual<
        typeof appleAndOrange['enum'],
        { readonly apple: 'apple'; readonly orange: 'orange' }
      >(true)
      assertEqual<
        typeof nativeBananaOnly['enum'],
        { readonly Banana: 'banana' }
      >(true)
      assertEqual<
        typeof nativeAppleAndOrange['enum'],
        { readonly Apple: 'apple'; readonly Orange: 'orange' }
      >(true)
    })
  })

  test('inference', () => {
    assertEqual<t.infer<typeof stringEnum>, 'a' | 'b' | 'c'>(true)
    assertEqual<t.infer<typeof numberEnum>, 1 | 2 | 3>(true)
    assertEqual<t.infer<typeof mixedEnum>, 'a' | 1 | 'b' | 2 | 'c' | 3>(true)
    assertEqual<t.infer<typeof nativeStringEnum>, 'a' | 'b' | 'c'>(true)
    assertEqual<t.infer<typeof nativeNumberEnum>, 0 | 1 | 2>(true)
  })
})
