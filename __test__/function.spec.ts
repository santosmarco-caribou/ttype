import t from '../src'
import { assertEqual } from './_utils'

describe('TFunction', () => {
  const args1 = t.tuple([t.string()])
  const returns1 = t.number()
  const func1 = t.function(args1, returns1)

  const args2 = t.tuple([
    t.object({
      f1: t.number(),
      f2: t.string().nullable(),
      f3: t.array(t.boolean().optional()).optional(),
    }),
  ])
  const returns2 = t.union([t.string(), t.number()])
  const func2 = t.function(args2, returns2)

  test('passes', () => {
    const parsed = func1.parse((x: any) => x.length)
    expect(() => parsed('abc')).not.toThrow()
  })

  test('fails', () => {
    const parsed = func1.parse((x: any) => x)
    // Wrong argument
    expect(() => parsed(13 as any)).toThrow()
    // Wrong return type
    expect(() => parsed('abc')).toThrow()
  })

  test('inference', () => {
    type func1 = t.infer<typeof func1>
    assertEqual<func1, (arg_0: string) => number>(true)

    type func2 = t.infer<typeof func2>
    assertEqual<
      func2,
      (arg: {
        f1: number
        f2: string | null
        f3?: (boolean | undefined)[] | undefined
      }) => string | number
    >(true)
  })

  test('methods', () => {
    const t1 = t.function()
    type t1 = t.infer<typeof t1>
    assertEqual<t1, (...args: unknown[]) => unknown>(true)

    const t2 = t1.args([t.string()])
    type t2 = t.infer<typeof t2>
    assertEqual<t2, (args_0: string) => unknown>(true)

    const t3 = t2.returns(t.boolean())
    type t3 = t.infer<typeof t3>
    assertEqual<t3, (args_0: string) => boolean>(true)
  })

  test('valid fn execution', () => {
    const validFunc2 = func2.validate((_x) => 'abc')
    expect(() => validFunc2({ f1: 1, f2: 'abc', f3: [true, false] })).not.toThrow()
  })

  test('invalid argument', () => {
    const invalidFunc = func2.validate((_x) => 'abc')
    expect(() => invalidFunc('invalid' as any)).toThrow()
  })

  test('invalid return type', () => {
    const invalidFunc = func2.validate((_x) => ['this', 'is', 'not', 'valid', 'output'] as any)
    expect(() => invalidFunc({ f1: 21, f2: 'asdf', f3: [true, false] })).toThrow()
  })

  test('invalid_arguments & invalid_return_type issues', () => {
    const fn = t.function(t.tuple([t.string()]), t.boolean()).implement((arg) => arg.length as any)

    try {
      fn(12 as any)
    } catch (err) {
      expect(err).toBeInstanceOf(t.TError)
      expect((err as t.TError).issues[0].kind).toBe(t.IssueKind.InvalidArguments)
      expect(
        ((err as t.TError).issues[0] as t.Issue<t.IssueKind.InvalidArguments>).payload.error
      ).toBeInstanceOf(t.TError)
    }

    try {
      fn('12')
    } catch (err) {
      expect(err).toBeInstanceOf(t.TError)
      expect((err as t.TError).issues[0].kind).toBe(t.IssueKind.InvalidReturnType)
      expect(
        ((err as t.TError).issues[0] as t.Issue<t.IssueKind.InvalidReturnType>).payload.error
      ).toBeInstanceOf(t.TError)
    }
  })

  test('function with async refinements', async () => {
    const func = t
      .function()
      .args([t.string().refine(async (val) => val.length > 10)])
      .returns(t.promise(t.number().refine(async (val) => val > 10)))
      .implement(async (val) => val.length)

    try {
      await func('abc')
    } catch (err) {
      expect(err).toBeDefined()
    }

    func('abcdefghijkl')
  })

  test('non-async function with async refinements should fail', async () => {
    const func = t
      .function()
      .args([t.string().refine(async (val) => val.length > 10)])
      .returns(t.number().refine(async (val) => val > 10))
      .implement((val) => val.length)

    expect(() => func('abcdefghijklmnopq')).toThrow()
  })

  test('parameters/returnType', () => {
    const func = t.function().args([t.string()]).returns(t.string())
    func.parameters.items[0].parse('asdf')
    func.returnType.parse('asdf')
  })

  test('inference with transforms', () => {
    const funcSchema = t
      .function()
      .args([t.string().transform((val) => val.length)])
      .returns(t.object({ val: t.number() }))
    const myFunc = funcSchema.implement((val) => ({ val, extra: 'stuff' }))
    expect(() => myFunc('asdf')).not.toThrow()
    assertEqual<typeof myFunc, (args_0: string) => { val: number; extra: string }>(true)
  })

  test('fallback to outer IO', () => {
    const funcSchema = t
      .function()
      .args([t.string().transform((val) => val.length)])
      .returns(t.object({ arg: t.number() }).transform((val) => val.arg))
    const myFunc = funcSchema.implement((val) => ({ arg: val, arg2: false }))
    assertEqual<typeof myFunc, (args_0: string) => number>(true)
  })

  test('decorate', () => {
    class MyClass {
      @t.decorate(t.function(t.tuple([t.string()])).returns(t.string()))
      // @ts-expect-error TS-1219
      myMethodA(arg: string) {
        return arg
      }

      @t.decorate(
        t
          .function(t.tuple([]).rest(t.string().or(t.number()).or(t.boolean())))
          .returns(t.string().or(t.number()).or(t.boolean()).array())
      )
      // @ts-expect-error TS-1219
      myMethodB(...args: (string | number | boolean)[]) {
        return args
      }

      @t.decorate(t.function(t.tuple([t.number()])).returns(t.string()))
      //                              ^ should have been string as per implementation, TS errors out
      // @ts-expect-error TS-1219
      myMethodC(arg: string) {
        return arg
      }

      // Alternative syntax (function => decorator)
      @t
        .function(t.tuple([t.boolean()]))
        .returns(t.instanceof(MyClass))
        .decorate()
      // @ts-expect-error TS-1219
      myMethodD(_arg: boolean): MyClass {
        return this
      }
    }

    const myClass = new MyClass()

    myClass.myMethodA('abc')
    myClass.myMethodB('abc', 123, true, false)
    myClass.myMethodD(true)
    expect(() => myClass.myMethodA(123 as any)).toThrow()
    expect(() => myClass.myMethodB({ a: 'abc' } as any)).toThrow()
  })
})
