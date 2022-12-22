import t from '../src'
import { utils } from '../src/utils'
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

  describe('entries', () => {
    test('works', () => {
      expect(utils.jsonStringify(A.entries)).toStrictEqual(
        utils.jsonStringify([
          ['a', t.string()],
          ['b', t.number()],
          ['c', t.boolean()],
        ])
      )
      expect(utils.jsonStringify(B.entries)).toStrictEqual(
        utils.jsonStringify([
          ['d', t.array(t.string()).optional()],
          ['e', t.record(t.string()).nullish()],
          ['f', t.map(t.string(), t.number()).promise()],
          ['g', t.tuple([t.string(), t.number()], t.bigint())],
          ['h', t.enum(['a', 1])],
        ])
      )
    })

    test('inference', () => {
      assertEqual<
        typeof A['entries'],
        (['a', t.TString] | ['b', t.TNumber] | ['c', t.TBoolean<{ coerce: false }>])[]
      >(true)
    })
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
      expect(utils.jsonStringify(aWithShapeAugment.shape)).toEqual(
        utils.jsonStringify({
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
      expect(utils.jsonStringify(bWithObjectAugment.shape)).toEqual(
        utils.jsonStringify({
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
      expect(utils.jsonStringify(aWithKeySet.shape)).toEqual(
        utils.jsonStringify({
          a: t.number(),
          b: t.number(),
          c: t.boolean(),
        })
      )
      expect(utils.jsonStringify(bWithKeySet.shape)).toEqual(
        utils.jsonStringify({
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
      expect(utils.jsonStringify(aDiff.shape)).toEqual(
        utils.jsonStringify({
          a: t.string(),
        })
      )
      expect(utils.jsonStringify(bDiff.shape)).toEqual(
        utils.jsonStringify({
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

  describe('merge', () => {
    const aMerge = A.merge(
      t
        .object({
          d: t.bigint(),
          e: t
            .object({
              f: t.boolean(),
            })
            .merge(B.catchall(t.string())),
        })
        .passthrough()
    )

    test('shape', () => {
      expect(utils.jsonStringify(aMerge.shape)).toEqual(
        utils.jsonStringify({
          a: t.string(),
          b: t.number(),
          c: t.boolean(),
          d: t.bigint(),
          e: t
            .object({
              f: t.promise(t.map(t.string(), t.number())),
              d: t.array(t.string()).optional(),
              e: t.record(t.string()).nullish(),
              g: t.tuple([t.string(), t.number()], t.bigint()),
              h: t.enum(['a', 1]),
            })
            .catchall(t.string()),
        })
      )
    })

    test('inference', () => {
      assertEqual<
        t.infer<typeof aMerge>,
        {
          a: string
          b: number
          c: boolean
          d: bigint
          e: {
            [x: string]: string
            // @ts-expect-error TS-2411
            f: Promise<Map<string, number>>
            // @ts-expect-error TS-2411
            d?: string[]
            // @ts-expect-error TS-2411
            e?: Record<string, string> | null | undefined
            // @ts-expect-error TS-2411
            g: readonly [string, number, ...bigint[]]
            // @ts-expect-error TS-2411
            h: 'a' | 1
          }
        } & { [x: string]: unknown }
      >(true)
    })
  })

  describe('pick', () => {
    const aPick = A.pick('a', 'b')
    const bPick = B.pick('d', 'e', 'f')

    test('shape', () => {
      expect(utils.jsonStringify(aPick.shape)).toEqual(
        utils.jsonStringify({
          a: t.string(),
          b: t.number(),
        })
      )
      expect(utils.jsonStringify(bPick.shape)).toEqual(
        utils.jsonStringify({
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
      expect(utils.jsonStringify(aOmit.shape)).toEqual(
        utils.jsonStringify({
          c: t.boolean(),
        })
      )
      expect(utils.jsonStringify(bOmit.shape)).toEqual(
        utils.jsonStringify({
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

  describe('partial', () => {
    const aPartial = A.partial()
    const bPartial = B.partial(['d', 'e', 'f'])

    test('shape', () => {
      expect(utils.jsonStringify(aPartial.shape)).toEqual(
        utils.jsonStringify({
          a: t.string().optional(),
          b: t.number().optional(),
          c: t.boolean().optional(),
        })
      )
      expect(utils.jsonStringify(bPartial.shape)).toEqual(
        utils.jsonStringify({
          d: t.array(t.string()).optional(),
          e: t.record(t.string()).nullish(),
          f: t.map(t.string(), t.number()).promise().optional(),
          g: t.tuple([t.string(), t.number()], t.bigint()),
          h: t.enum(['a', 1]),
        })
      )
    })

    test('inference', () => {
      assertEqual<
        t.infer<typeof aPartial>,
        {
          a?: string | undefined
          b?: number | undefined
          c?: boolean | undefined
        }
      >(true)
      assertEqual<
        t.infer<typeof bPartial>,
        {
          d?: string[] | undefined
          e?: Record<string, string> | null | undefined
          f?: Promise<Map<string, number>> | undefined
          g: readonly [string, number, ...bigint[]]
          h: 'a' | 1
        }
      >(true)
    })
  })

  describe('required', () => {
    const aRequired = A.partial().required(['a'])
    const bRequired = B.partial().required(['d', 'e', 'f'])

    test('shape', () => {
      expect(utils.jsonStringify(aRequired.shape)).toEqual(
        utils.jsonStringify({
          a: t.string(),
          b: t.number().optional(),
          c: t.boolean().optional(),
        })
      )
      console.log(bRequired.shape)
      expect(utils.jsonStringify(bRequired.shape)).toEqual(
        utils.jsonStringify({
          d: t.array(t.string()),
          e: t.record(t.string()).nullable(),
          f: t.map(t.string(), t.number()).promise(),
          g: t.tuple([t.string(), t.number()], t.bigint()).optional(),
          h: t.enum(['a', 1]).optional(),
        })
      )
    })

    test('inference', () => {
      assertEqual<
        t.infer<typeof aRequired>,
        {
          a: string
          b?: number | undefined
          c?: boolean | undefined
        }
      >(true)
      assertEqual<
        t.infer<typeof bRequired>,
        {
          d: string[]
          e: Record<string, string> | null
          f: Promise<Map<string, number>>
          g?: readonly [string, number, ...bigint[]]
          h?: 'a' | 1
        }
      >(true)
    })
  })
})
