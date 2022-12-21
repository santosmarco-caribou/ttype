import { t } from './src'

export const Food = t
  .object({
    name: t.string(),
    description: t.string().optional(),
    calories: t.number().optional(),
    fat: t.number().optional(),
    carbs: t.number().optional(),
    protein: t.number().optional(),
    marco: t.array(t.tuple([t.string(), t.number()], t.enum(['a', 1]))),
  })
  .catchall(t.record(t.symbol()))

// Food.parse({
//   name: 'foo',
//   description: 'bar',
//   calories: 100,
// })

const sadas = t.string().default('a').hint

const testFn = t.fn(t.tuple([t.string(), t.number()]), t.never()).hint
console.log(Food.hint)
type asaas = t.infer<typeof Food>

const asda = t
  .record(t.enum(['a', 1]), t.map(t.number(), t.record(t.symbol())))
  .partial()

type sadas = t.infer<typeof asda>

const sd = t.array(t.tuple([t.string(), t.number()], t.enum(['a', 1]))).hint
