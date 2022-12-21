import t from '../src'
import { assertEqual } from './_utils'

describe('TBoolean', () => {
  describe('coercion', () => {
    const noArgCoercion = t.boolean().coerce()
    const falseArgCoercion = t.boolean().coerce(false)
    const truthyValuesCoercion = t.boolean().coerce({ true: ['yes'] })
    const falsyValuesCoercion = t.boolean().coerce({ false: ['no'] })
    const truthyAndFalsyValuesCoercion = t
      .boolean()
      .coerce({ true: ['yes'], false: ['no'] })
    const truthyValueWithTrueCoercion = t
      .boolean()
      .coerce({ true: ['yes', true] })
    const truthy = ['yes', 'y', 1] as const
    const usingTruthy = t.boolean().truthy(truthy)
    const falsy = ['no', 'n', 0] as const
    const usingFalsy = t.boolean().falsy(falsy)
    const usingTruthyAndFalsy = t.boolean().truthy(truthy).falsy(falsy)

    test('passes', () => {
      expect(noArgCoercion.safeParse('Michael').data).toBe(true)
      expect(noArgCoercion.safeParse('').data).toBe(false)
      expect(truthyValuesCoercion.safeParse('yes').data).toBe(true)
      expect(truthyValuesCoercion.safeParse('y').ok).toBe(false)
      expect(falsyValuesCoercion.safeParse('no').data).toBe(false)
      expect(falsyValuesCoercion.safeParse('n').ok).toBe(false)
      expect(truthyAndFalsyValuesCoercion.safeParse('yes').data).toBe(true)
      expect(truthyAndFalsyValuesCoercion.safeParse('no').data).toBe(false)
      truthy.forEach((val) => {
        expect(usingTruthy.safeParse(val).data).toBe(true)
        expect(usingTruthyAndFalsy.safeParse(val).data).toBe(true)
      })
      falsy.forEach((val) => {
        expect(usingFalsy.safeParse(val).data).toBe(false)
        expect(usingTruthyAndFalsy.safeParse(val).data).toBe(false)
      })
    })

    test('fails', () => {
      expect(() => falseArgCoercion.parse('Michael')).toThrow()
    })

    test('inference', () => {
      assertEqual<t.input<typeof noArgCoercion>, unknown>(true)
      assertEqual<t.input<typeof falseArgCoercion>, boolean>(true)
      assertEqual<t.input<typeof truthyValuesCoercion>, 'yes'>(true)
      assertEqual<t.input<typeof falsyValuesCoercion>, 'no'>(true)
      assertEqual<t.input<typeof truthyAndFalsyValuesCoercion>, 'yes' | 'no'>(
        true
      )
      assertEqual<t.input<typeof truthyValueWithTrueCoercion>, 'yes' | true>(
        true
      )
      assertEqual<t.input<typeof usingTruthy>, 'yes' | 'y' | 1>(true)
      assertEqual<t.input<typeof usingFalsy>, 'no' | 'n' | 0>(true)
      assertEqual<
        t.input<typeof usingTruthyAndFalsy>,
        'yes' | 'y' | 1 | 'no' | 'n' | 0
      >(true)
    })
  })
})
