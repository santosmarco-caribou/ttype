import t from '../src'
import { assertEqual } from './_utils'

describe('TEnum', () => {
  const stringEnum = t.enum(['a', 'b', 'c'])
  const numberEnum = t.enum([1, 2, 3])
  const mixedEnum = t.enum(['a', 1, 'b', 2, 'c', 3])
  enum MyStringEnum {
    A = 'a',
    B = 'b',
    C = 'c',
  }
  enum MyNumberEnum {
    A,
    B,
    C,
  }
  const nativeEnum = t.enum(MyStringEnum)
  const nativeNumberEnum = t.enum(MyNumberEnum)

  test('hint', () => {
    expect(stringEnum.hint).toBe('"a" | "b" | "c"')
    expect(numberEnum.hint).toBe('1 | 2 | 3')
    expect(mixedEnum.hint).toBe('"a" | 1 | "b" | 2 | "c" | 3')
    expect(nativeEnum.hint).toBe('"a" | "b" | "c"')
    expect(nativeNumberEnum.hint).toBe('0 | 1 | 2')
    assertEqual<typeof stringEnum['hint'], '"a" | "b" | "c"'>(true)
    assertEqual<typeof numberEnum['hint'], '1 | 2 | 3'>(true)
    assertEqual<typeof mixedEnum['hint'], '"a" | 1 | "b" | 2 | "c" | 3'>(true)
    assertEqual<typeof nativeEnum['hint'], '"a" | "b" | "c"'>(true)
    assertEqual<typeof nativeNumberEnum['hint'], '0 | 1 | 2'>(true)
  })

  test('works', () => {
    expect(stringEnum.values).toStrictEqual(['a', 'b', 'c'])
    expect(numberEnum.values).toStrictEqual([1, 2, 3])
    expect(mixedEnum.values).toStrictEqual(['a', 1, 'b', 2, 'c', 3])
    expect(nativeEnum.values).toStrictEqual(['a', 'b', 'c'])
    expect(nativeNumberEnum.values).toStrictEqual([0, 1, 2])
    expect(stringEnum.enum).toStrictEqual({ a: 'a', b: 'b', c: 'c' })
    expect(numberEnum.enum).toStrictEqual({ 1: 1, 2: 2, 3: 3 })
    expect(mixedEnum.enum).toStrictEqual({ a: 'a', 1: 1, b: 'b', 2: 2, c: 'c', 3: 3 })
    expect(nativeEnum.enum).toStrictEqual({ A: MyStringEnum.A, B: MyStringEnum.B, C: MyStringEnum.C })
    expect(nativeNumberEnum.enum).toStrictEqual({ A: MyNumberEnum.A, B: MyNumberEnum.B, C: MyNumberEnum.C })
  })

  test('inference', () => {
    assertEqual<t.infer<typeof stringEnum>, 'a' | 'b' | 'c'>(true)
    assertEqual<t.infer<typeof numberEnum>, 1 | 2 | 3>(true)
    assertEqual<t.infer<typeof mixedEnum>, 'a' | 1 | 'b' | 2 | 'c' | 3>(true)
    assertEqual<t.infer<typeof nativeEnum>, 'a' | 'b' | 'c'>(true)
    assertEqual<t.infer<typeof nativeNumberEnum>, 0 | 1 | 2>(true)
    assertEqual<typeof stringEnum['values'], readonly ['a', 'b', 'c']>(true)
    assertEqual<typeof numberEnum['values'], readonly [1, 2, 3]>(true)
    assertEqual<typeof mixedEnum['values'], readonly ['a', 1, 'b', 2, 'c', 3]>(true)
    assertEqual<typeof nativeEnum['values'], readonly ['a', 'b', 'c']>(true)
    assertEqual<typeof nativeNumberEnum['values'], readonly [0, 1, 2]>(true)
    assertEqual<typeof stringEnum['enum'], { readonly a: 'a'; readonly b: 'b'; readonly c: 'c' }>(true)
    assertEqual<typeof numberEnum['enum'], { readonly 1: 1; readonly 2: 2; readonly 3: 3 }>(true)
    assertEqual<
      typeof mixedEnum['enum'],
      { readonly a: 'a'; readonly 1: 1; readonly b: 'b'; readonly 2: 2; readonly c: 'c'; readonly 3: 3 }
    >(true)
    assertEqual<
      typeof nativeEnum['enum'],
      { readonly A: MyStringEnum.A; readonly B: MyStringEnum.B; readonly C: MyStringEnum.C }
    >(true)
    assertEqual<
      typeof nativeNumberEnum['enum'],
      { readonly A: MyNumberEnum.A; readonly B: MyNumberEnum.B; readonly C: MyNumberEnum.C }
    >(true)
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
    const nativeBananaEnum = t.enum(FoodEnum)
    const nativeBananaOnly = nativeBananaEnum.extract(FoodEnum.Banana)
    const nativeAppleAndOrange = nativeBananaEnum.exclude([FoodEnum.Banana])

    test('works', () => {
      expect(bananaOnly.values).toStrictEqual(['banana'])
      expect(appleAndOrange.values).toStrictEqual(['apple', 'orange'])
      expect(nativeBananaOnly.values).toStrictEqual(['banana'])
      expect(nativeAppleAndOrange.values).toStrictEqual(['apple', 'orange'])
      expect(bananaOnly.enum).toStrictEqual({ banana: 'banana' })
      expect(appleAndOrange.enum).toStrictEqual({ apple: 'apple', orange: 'orange' })
      expect(nativeBananaOnly.enum).toStrictEqual({ Banana: FoodEnum.Banana })
      expect(nativeAppleAndOrange.enum).toStrictEqual({ Apple: FoodEnum.Apple, Orange: FoodEnum.Orange })
    })

    test('inference', () => {
      assertEqual<t.infer<typeof bananaOnly>, 'banana'>(true)
      assertEqual<t.infer<typeof appleAndOrange>, 'apple' | 'orange'>(true)
      assertEqual<t.infer<typeof nativeBananaOnly>, 'banana'>(true)
      assertEqual<t.infer<typeof nativeAppleAndOrange>, 'apple' | 'orange'>(true)
      assertEqual<typeof bananaOnly['values'], readonly ['banana']>(true)
      assertEqual<typeof appleAndOrange['values'], readonly ['apple', 'orange']>(true)
      assertEqual<typeof nativeBananaOnly['values'], readonly ['banana']>(true)
      assertEqual<typeof nativeAppleAndOrange['values'], readonly ['apple', 'orange']>(true)
      assertEqual<typeof bananaOnly['enum'], { readonly banana: 'banana' }>(true)
      assertEqual<typeof appleAndOrange['enum'], { readonly apple: 'apple'; readonly orange: 'orange' }>(true)
      assertEqual<typeof nativeBananaOnly['enum'], { readonly Banana: FoodEnum.Banana }>(true)
      assertEqual<
        typeof nativeAppleAndOrange['enum'],
        { readonly Apple: FoodEnum.Apple; readonly Orange: FoodEnum.Orange }
      >(true)
    })
  })
})
