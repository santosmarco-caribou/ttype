import { t } from './src'

export const Food = t
  .object({
    name: t.string(),
    description: t.string().optional(),
    calories: t.number().optional(),
    fat: t.number().optional(),
    carbs: t.number().optional(),
    protein: t.number().optional(),
  })
  .or(t.string())

Food.parse({
  name: 'foo',
  description: 'bar',
  calories: 100,
})
