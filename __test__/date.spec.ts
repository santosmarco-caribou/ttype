import t from '../src'
import { assertEqual } from './_utils'

describe('TDate', () => {
  test('coercion', () => {
    const noCoercion = t.date()
    const fullCoercion = t.date().coerce()
    const stringCoercion = t.date().coerce('strings')
    const numberCoercion = t.date().coerce('numbers')

    expect(noCoercion.safeParse('2020-01-01').ok).toBe(false)
    expect(fullCoercion.safeParse('2020-01-01').ok).toBe(true)
    expect(fullCoercion.safeParse('2020-01-01').data).toBeInstanceOf(Date)
    expect(stringCoercion.safeParse('2020-01-01').ok).toBe(true)
    expect(stringCoercion.safeParse('2020-01-01').data).toBeInstanceOf(Date)
    expect(numberCoercion.safeParse(new Date().getTime()).ok).toBe(true)
    expect(numberCoercion.safeParse(new Date().getTime()).data).toBeInstanceOf(
      Date
    )

    assertEqual<t.input<typeof noCoercion>, Date>(true)
    assertEqual<t.input<typeof fullCoercion>, Date | string | number>(true)
    assertEqual<t.input<typeof stringCoercion>, Date | string>(true)
    assertEqual<t.input<typeof numberCoercion>, Date | number>(true)
  })
})
