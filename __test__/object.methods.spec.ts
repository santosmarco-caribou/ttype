import t from '../src'
import { assertEqual } from './_utils'

describe('TObject :: methods', () => {
  const A = t.object({
    a: t.string(),
    b: t.number(),
    c: t.boolean(),
  })
  const B = t.object({
    d: t.array(t.string()).optional(),
    e: t.record(t.string()).nullish(),
    f: t.map(t.string(), t.number()).promise(),
    g: t.tuple([t.string(), t.number()], t.bigint()),
    h: t.enum(['a', 1]),
  })

  describe('passthrough', () => {
    const aWithPassthrough = A.passthrough()
    const bWithPassthrough = B.passthrough()

    test('inference', () => {
      assertEqual<
        t.infer<typeof aWithPassthrough>,
        {
          a: string
          b: number
          c: boolean
        } & { [x: string]: unknown }
      >(true)
      assertEqual<
        t.infer<typeof bWithPassthrough>,
        {
          d?: string[]
          e?: Record<string, string> | null | undefined
          f: Promise<Map<string, number>>
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
        } & { [x: string]: unknown }
      >(true)
    })
  })

  describe('strip', () => {
    const stripA = A.strip()
    const stripB = B.strip()

    test('inference', () => {
      assertEqual<
        t.infer<typeof stripA>,
        {
          a: string
          b: number
          c: boolean
        }
      >(true)
      assertEqual<
        t.infer<typeof stripB>,
        {
          d?: string[]
          e?: Record<string, string> | null | undefined
          f: Promise<Map<string, number>>
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
        }
      >(true)
    })
  })

  describe('strict', () => {
    const strictA = A.strict()
    const strictB = B.strict()

    test('inference', () => {
      assertEqual<
        t.infer<typeof strictA>,
        {
          a: string
          b: number
          c: boolean
        } & { [x: string]: never }
      >(true)
      assertEqual<
        t.infer<typeof strictB>,
        {
          d?: string[]
          e?: Record<string, string> | null | undefined
          f: Promise<Map<string, number>>
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
        } & { [x: string]: never }
      >(true)
    })
  })

  describe('catchall', () => {
    const aWithStringCatchall = A.catchall(t.string())
    const bWithNumberCatchall = B.catchall(t.number())

    test('inference', () => {
      assertEqual<
        t.infer<typeof aWithStringCatchall>,
        {
          a: string
          b: number
          c: boolean
        } & { [x: string]: string }
      >(true)
      assertEqual<
        t.infer<typeof bWithNumberCatchall>,
        {
          d?: string[]
          e?: Record<string, string> | null | undefined
          f: Promise<Map<string, number>>
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
        } & { [x: string]: number }
      >(true)
    })
  })

  describe('keyof', () => {
    const keyofA = A.keyof()
    const keyofB = B.keyof()

    test('values/enum', () => {
      expect(keyofA.values).toStrictEqual(['a', 'b', 'c'])
      expect(keyofB.values).toStrictEqual(['d', 'e', 'f', 'g', 'h'])
      expect(keyofA.enum).toStrictEqual({ a: 'a', b: 'b', c: 'c' })
      expect(keyofB.enum).toStrictEqual({
        d: 'd',
        e: 'e',
        f: 'f',
        g: 'g',
        h: 'h',
      })
    })

    test('inference', () => {
      assertEqual<typeof keyofA['values'], readonly ['a', 'b', 'c']>(true)
      assertEqual<typeof keyofB['values'], readonly ['d', 'e', 'f', 'g', 'h']>(true)
      assertEqual<typeof keyofA['enum'], { readonly a: 'a'; readonly b: 'b'; readonly c: 'c' }>(
        true
      )
      assertEqual<
        typeof keyofB['enum'],
        {
          readonly d: 'd'
          readonly e: 'e'
          readonly f: 'f'
          readonly g: 'g'
          readonly h: 'h'
        }
      >(true)
      assertEqual<t.infer<typeof keyofA>, 'a' | 'b' | 'c'>(true)
      assertEqual<t.infer<typeof keyofB>, 'd' | 'e' | 'f' | 'g' | 'h'>(true)
    })
  })

  describe('augment', () => {
    const aWithShapeAugment = A.augment({
      d: t.array(t.string()).optional(),
      e: t.record(t.string()).nullish(),
      f: t.map(t.string(), t.number()).promise(),
      g: t.tuple([t.string(), t.number()], t.bigint()),
      h: t.enum(['a', 1]),
    })
    const bWithObjectAugment = B.augment(
      t.object({
        a: t.string(),
        b: t.number(),
        c: t.boolean(),
      })
    )

    test('shape', () => {
      expect(JSON.stringify(aWithShapeAugment.shape)).toEqual(
        JSON.stringify({
          a: t.string(),
          b: t.number(),
          c: t.boolean(),
          d: t.array(t.string()).optional(),
          e: t.record(t.string()).nullish(),
          f: t.map(t.string(), t.number()).promise(),
          g: t.tuple([t.string(), t.number()], t.bigint()),
          h: t.enum(['a', 1]),
        })
      )
      expect(JSON.stringify(bWithObjectAugment.shape)).toEqual(
        JSON.stringify({
          d: t.array(t.string()).optional(),
          e: t.record(t.string()).nullish(),
          f: t.map(t.string(), t.number()).promise(),
          g: t.tuple([t.string(), t.number()], t.bigint()),
          h: t.enum(['a', 1]),
          a: t.string(),
          b: t.number(),
          c: t.boolean(),
        })
      )
    })

    test('inference', () => {
      assertEqual<
        t.infer<typeof aWithShapeAugment>,
        {
          a: string
          b: number
          c: boolean
          d?: string[]
          e?: Record<string, string> | null | undefined
          f: Promise<Map<string, number>>
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
        }
      >(true)
      assertEqual<
        t.infer<typeof bWithObjectAugment>,
        {
          a: string
          b: number
          c: boolean
          d?: string[]
          e?: Record<string, string> | null | undefined
          f: Promise<Map<string, number>>
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
        }
      >(true)
    })
  })

  describe('setKey', () => {
    const aWithKeySet = A.setKey('a', t.number())
    const bWithKeySet = B.setKey('i', t.set(t.bigint()).nullish())

    test('shape', () => {
      expect(JSON.stringify(aWithKeySet.shape)).toEqual(
        JSON.stringify({
          a: t.number(),
          b: t.number(),
          c: t.boolean(),
        })
      )
      expect(JSON.stringify(bWithKeySet.shape)).toEqual(
        JSON.stringify({
          d: t.array(t.string()).optional(),
          e: t.record(t.string()).nullish(),
          f: t.map(t.string(), t.number()).promise(),
          g: t.tuple([t.string(), t.number()], t.bigint()),
          h: t.enum(['a', 1]),
          i: t.set(t.bigint()).nullish(),
        })
      )
    })

    test('inference', () => {
      assertEqual<
        t.infer<typeof aWithKeySet>,
        {
          a: number
          b: number
          c: boolean
        }
      >(true)
      assertEqual<
        t.infer<typeof bWithKeySet>,
        {
          d?: string[]
          e?: Record<string, string> | null | undefined
          f: Promise<Map<string, number>>
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
          i?: Set<bigint> | null | undefined
        }
      >(true)
    })
  })

  describe('diff', () => {
    const aDiff = A.diff({
      b: t.number(),
      c: t.boolean(),
    })
    const bDiff = B.diff({
      d: t.array(t.string()).optional(),
      e: t.record(t.string()).nullish(),
      f: t.map(t.string(), t.number()).promise(),
    })

    test('shape', () => {
      expect(JSON.stringify(aDiff.shape)).toEqual(
        JSON.stringify({
          a: t.string(),
        })
      )
      expect(JSON.stringify(bDiff.shape)).toEqual(
        JSON.stringify({
          g: t.tuple([t.string(), t.number()], t.bigint()),
          h: t.enum(['a', 1]),
        })
      )
    })

    test('inference', () => {
      assertEqual<
        t.infer<typeof aDiff>,
        {
          a: string
        }
      >(true)
      assertEqual<
        t.infer<typeof bDiff>,
        {
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
        }
      >(true)
    })
  })

  describe('pick', () => {
    const aPick = A.pick('a', 'b')
    const bPick = B.pick('d', 'e', 'f')

    test('shape', () => {
      expect(JSON.stringify(aPick.shape)).toEqual(
        JSON.stringify({
          a: t.string(),
          b: t.number(),
        })
      )
      expect(JSON.stringify(bPick.shape)).toEqual(
        JSON.stringify({
          d: t.array(t.string()).optional(),
          e: t.record(t.string()).nullish(),
          f: t.map(t.string(), t.number()).promise(),
        })
      )
    })

    test('inference', () => {
      assertEqual<
        t.infer<typeof aPick>,
        {
          a: string
          b: number
        }
      >(true)
      assertEqual<
        t.infer<typeof bPick>,
        {
          d?: string[]
          e?: Record<string, string> | null | undefined
          f: Promise<Map<string, number>>
        }
      >(true)
    })
  })

  describe('omit', () => {
    const aOmit = A.omit('a', 'b')
    const bOmit = B.omit('d', 'e', 'f')

    test('shape', () => {
      expect(JSON.stringify(aOmit.shape)).toEqual(
        JSON.stringify({
          c: t.boolean(),
        })
      )
      expect(JSON.stringify(bOmit.shape)).toEqual(
        JSON.stringify({
          g: t.tuple([t.string(), t.number()], t.bigint()),
          h: t.enum(['a', 1]),
        })
      )
    })

    test('inference', () => {
      assertEqual<
        t.infer<typeof aOmit>,
        {
          c: boolean
        }
      >(true)
      assertEqual<
        t.infer<typeof bOmit>,
        {
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
        }
      >(true)
    })
  })
})
