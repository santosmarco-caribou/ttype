import { inspect } from 'util'
import { t } from './src'
// import { TType } from './src/types/_external'
// // const Color = t
// //   .object({
// //     r: t.number(),
// //     g: t.number(),
// //     b: t.number(),
// //   })
// //   .strict()
// //   .or(t.tuple([t.number(), t.number(), t.number()]))
// //   .or(t.string())

// import { Zero } from 'type-fest/source/numeric'
// import t, { TTypeName, flattenUnionMembers } from './src'

// // // console.log(
// // //   Color.parse({
// // //     r: 1,
// // //     g: 3,
// // //     b: 4,
// // //     a: 2,
// // //   })
// // // )

// // // console.log(t.any().setMeta({}))

// // // console.log(t.string().url().uuid().email({ message: 'asas' }).uppercase().coerce().parse(3))
// // // let a = -1
// // // const A = t.string().url().uuid().email().coerce().uppercase().min(a)
// // // type A = t.input<typeof A>

// // const m = t
// //   .map(
// //     t.string(),
// //     t.set(
// //       t.tuple([
// //         t.string(),
// //         t.object({
// //           a: t.string(),
// //           b: t.number(),
// //           c: t.boolean(),
// //           d: t.object({
// //             a: t.string(),
// //             b: t.number(),
// //             c: t.boolean(),
// //             d: t.promise(
// //               t.object({
// //                 a: t.string(),
// //               })
// //             ),
// //           }),
// //         }),
// //       ])
// //     )
// //   )
// //   .readonlyDeep()
// // type m = t.infer<typeof m>

// // const o = t.object({
// //   a: t.string(),
// //   c: t.set(
// //     t.object({
// //       a: t.map(t.string(), t.string()),
// //     })
// //   ),
// // })
// // type o = t.infer<typeof o>

// // const a = t
// //   .union(
// //     t.string(),
// //     t.number(),
// //     t.boolean().brand('my boolean'),
// //     t.bigint().nullish(),
// //     t.date().array().or(t.nan()),
// //     t.bigint() /* again */,
// //     t.set(t.primitive()).nullable(),
// //     t.readonly(t.set(t.primitive()).or(t.array(t.buffer()))),
// //     t.lazy(() => t.map(t.propertykey(), t.enum(['a', 'b', 'c'])).readonly()),
// //     t
// //       .tuple([t.number(), t.date().readonly()], t.string().nullish())
// //       .readonly()
// //       .promise(),
// //     t.array(t.array(t.buffer().readonly()).readonly()).readonly(),
// //     t
// //       .array(
// //         t
// //           .tuple([
// //             t.buffer().readonly(),
// //             t.date().readonly(),
// //             t.array(t.tuple([t.number(), t.string()]).readonly()).readonly(),
// //           ])
// //           .readonly()
// //       )
// //       .readonly()
// //   )
// //   .or(
// //     t
// //       .object({
// //         a: t.string(),
// //         b: t.number().or(t.boolean()),
// //         c: t.union(t.string(), t.number(), t.bigint()).or(t.any()),
// //         d: t
// //           .object({
// //             e: t
// //               .function(
// //                 t.tuple(
// //                   [t.string(), t.number(), t.date().readonly()],
// //                   t.number().array()
// //                 )
// //               )
// //               .returns(t.string().readonly()),
// //           })
// //           .readonly(),
// //       })
// //       .or([t.string(), t.number()])
// //   )
// // console.log(
// //   t
// //     .union(
// //       t.string(),
// //       t.number(),
// //       t.boolean().brand('my boolean'),
// //       t.bigint().nullish(),
// //       t.date().array().or(t.nan()),
// //       t.bigint() /* again */,
// //       t.set(t.primitive()).nullable(),
// //       t.readonly(t.set(t.primitive()).or(t.array(t.buffer()))),
// //       t.lazy(() => t.map(t.propertykey(), t.enum(['a', 'b', 'c'])).readonly()),
// //       t
// //         .tuple([t.number(), t.date().readonly()], t.string().nullish())
// //         .readonly()
// //         .promise(),
// //       t.array(t.array(t.buffer().readonly()).readonly()).readonly(),
// //       t
// //         .array(
// //           t
// //             .tuple([
// //               t.buffer().readonly(),
// //               t.date().readonly(),
// //               t.array(t.tuple([t.number(), t.string()]).readonly()).readonly(),
// //             ])
// //             .readonly()
// //         )
// //         .readonly()
// //     )
// //     .or(
// //       t
// //         .object({
// //           a: t.string(),
// //           b: t.number().or(t.boolean()),
// //           c: t.union(t.string(), t.number(), t.bigint()).or(t.any()),
// //           d: t
// //             .object({
// //               e: t
// //                 .function(
// //                   t.tuple(
// //                     [t.string(), t.number(), t.date().readonly()],
// //                     t.number().array()
// //                   )
// //                 )
// //                 .returns(t.string().readonly()),
// //             })
// //             .readonly(),
// //         })
// //         .or([t.string(), t.number()])
// //     )
// //     .show()
// // )

// // type sdsd = t.infer<typeof a>

// // console.log(t.string().min(2))

// // const myString = t
// //   .string()
// //   .min(2)
// //   .max(5)
// //   .uppercase()
// //   .coerce()
// //   .nullable()
// //   .optional()
// //   .default('a')
// // const asdsd = t.any()

// // t.preprocess((arg) => new Date(), t.date())

// // const dfsdf = t.string().optional().optional()

// // console.log(new TType({ typeName: TTypeName.Any }).optional().optional())

console.log(
  inspect(t.any().array().optional(), {
    depth: Infinity,
    colors: true,
  })
)
