import { t } from './src'

// // export const Food = t
// //   .object({
// //     name: t.string(),
// //     description: t.string().optional(),
// //     calories: t.number().optional(),
// //     fat: t.number().optional(),
// //     carbs: t.number().optional(),
// //     protein: t.number().optional(),
// //     marco: t.array(t.tuple([t.string(), t.number()], t.enum(['a', 1]))),
// //   })
// //   .catchall(t.record(t.symbol()))

// // // Food.parse({
// // //   name: 'foo',
// // //   description: 'bar',
// // //   calories: 100,
// // // })

// // const sadas = t.string().default('a').hint

// // const testFn = t.fn(t.tuple([t.string(), t.number()]), t.never()).hint
// // console.log(Food.hint)
// // type asaas = t.infer<typeof Food>

// // const asda = t
// //   .record(t.enum(['a', 1]), t.map(t.number(), t.record(t.symbol())))
// //   .partial()

// // type sadas = t.infer<typeof asda>

// // const sd = t.array(t.tuple([t.string(), t.number()], t.enum(['a', 1]))).hint

// // const A = t.object({
// //   a: t.string(),
// //   b: t.number(),
// //   c: t.boolean(),
// //   d: t.array(t.string()),
// //   e: t.record(t.string()),
// //   f: t.map(t.string(), t.number()),
// //   g: t.tuple([t.string(), t.number()]),
// //   h: t.enum(['a', 1]),
// //   i: t.union([t.string(), t.number()]),
// //   j: t.intersection([t.string(), t.number()]),
// //   k: t.literal('a'),
// //   l: t.symbol(),
// //   m: t.never(),
// //   n: t.any(),
// //   o: t.unknown(),
// //   p: t.null(),
// //   q: t.undefined(),
// //   r: t.void(),
// //   s: t.function(t.tuple([t.string()])),
// //   t: t.promise(t.string()),
// //   u: t.promise(t.string()),
// //   v: t.optional(t.string()),
// //   w: t.catch(t.string(), 'a'),
// // })

// // type A = t.infer<typeof A>

// // const B = t.object({
// //   a: t.string(),
// //   b: t.number(),
// //   c: t.boolean(),
// //   d: t.array(t.string()),
// //   e: t.record(t.string()),
// //   f: t.map(t.string(), t.number()),
// //   g: t.tuple([t.string(), t.number()]),
// //   h: t.enum(['a', 1]),
// //   i: t.union([t.string(), t.number()]),
// //   j: t.intersection([t.string(), t.number()]),
// //   k: t.literal('a'),
// //   l: t.symbol(),
// //   m: t.never(),
// //   n: t.any(),
// //   o: t.unknown(),
// // })

// // type B = t.infer<typeof B>

// // const C = A.diff(B).partial(['p', 'q', 's']).entries

// // type C = t.infer<typeof C>

// // // const D = C.omit(['p', 'q', 'r', 's', 't', 'v', 'u', 'w'])

// // type D = t.infer<typeof D>

// // // console.log(Object.keys(C.shape))

// // const ttueprp = t.tuple([]).push(t.string(), t.number())

// // // const sdsad = t.function().append([t.string()])

// // // console.log(ttueprp)

// // // console.log(C)

// // const bEntries = B.entries

// // // const bb = t.object.fromEntries(bEntries)

// // console.log(
// //   t
// //     .object({
// //       a: t.string(),
// //       b: t.number(),
// //     })
// //     .parse({
// //       a: 'a',
// //     })
// // )

const c = t
  .object({
    d: t.array(t.true()),
    e: t.record(t.string()).nullable(),
    // f: t.map(t.string(), t.number()).promise(),
    // g: t.tuple([t.string(), t.number()], t.bigint()).optional(),
    h: t.fn().returns(t.any()),
  })
  .setPartial()
  .catchall(t.string())

// console.log(c.shape)

// // console.log(
// //   c.parse({
// //     d: 5,
// //     e: 'a',
// //   })
// // )

const sdkjsd = t
  .tuple([t.string(), t.number(), t.bigint(), t.any(), t.optional(t.number())])
  .partial()

console.log(c.hint)

type sdskd = t.infer<typeof c>
