import t from '../src'
import { assertEqual } from './_utils'

describe('TBranded', () => {
  test('works', () => {
    const A = t
      .object({
        name: t.string(),
      })
      .brand('superschema')

    // simple branding
    type A = t.infer<typeof A>
    assertEqual<A, { name: string } & t.Brand<'superschema'>>(true)

    const doStuff = (arg: A) => arg
    doStuff(A.parse({ name: 'hello there' }))

    // inheritance
    const extendedSchema = A.brand('subschema')
    type ExtendedSchema = t.infer<typeof extendedSchema>
    assertEqual<ExtendedSchema, { name: string } & t.Brand<'superschema'> & t.Brand<'subschema'>>(
      true
    )

    doStuff(extendedSchema.parse({ name: 'hello again' }))

    // number branding
    const numberSchema = t.number().brand(42)
    type NumberSchema = t.infer<typeof numberSchema>
    assertEqual<NumberSchema, number & t.Brand<42>>(true)

    // symbol branding
    const MyBrand: unique symbol = Symbol('hello')
    type MyBrand = typeof MyBrand
    const symbolBrand = t.number().brand('sup').brand(MyBrand)
    type SymbolBrand = t.infer<typeof symbolBrand>
    assertEqual<SymbolBrand, number & t.Brand<'sup'> & t.Brand<MyBrand>>(true)

    // keeping brands out of input types
    const age = t.number().brand('age')
    type Age = t.infer<typeof age>
    type AgeInput = t.input<typeof age>
    assertEqual<AgeInput, Age>(false)
    assertEqual<number, AgeInput>(true)
    assertEqual<number & t.Brand<'age'>, Age>(true)

    // @ts-expect-error '[BRAND]' is declared here.
    doStuff({ name: 'hello there!' })
  })
})
