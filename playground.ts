import { t } from './src'

const Color = t
  .object({
    r: t.number(),
    g: t.number(),
    b: t.number(),
  })
  .strict()
  .or(t.tuple([t.number(), t.number(), t.number()]))
  .or(t.string())

console.log(
  Color.parse({
    r: 1,
    g: 3,
    b: 4,
    a: 2,
  })
)
