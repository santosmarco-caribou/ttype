import t from '../src'
import { assertEqual } from './_utils'
import { tobjectUtils } from './_utils.object'

describe('TObject :: inference', () => {
  test('Color', () => {
    assertEqual<
      t.infer<typeof tobjectUtils['Color']>,
      | ({
          r: number
          g: number
          b: number
        } & { [x: string]: never })
      | readonly [number, number, number]
      | string
    >(true)
  })

  test('Food', () => {
    assertEqual<
      t.infer<typeof tobjectUtils['Food']>,
      | {
          name: string
          description?: string
          calories?: number
          fat?: number
          carbs?: number
          protein?: number
        }
      | string
    >(true)
  })

  test('Pet', () => {
    assertEqual<
      t.infer<typeof tobjectUtils['Pet']>,
      {
        kind: 'cat' | 'dog' | 'bird' | 'fish' | 'other'
        name: string
        age: number
      }
    >(true)
  })

  test('Address', () => {
    assertEqual<
      t.infer<typeof tobjectUtils['Address']>,
      {
        kind: 'rent' | 'own' | 'parents' | 'other'
        street: [string, string?, string?, string?, ...never[]]
        city: string
        state: string
        zip: string
      } & { [x: string]: unknown }
    >(true)
  })

  test('StartEndDate', () => {
    assertEqual<
      t.input<typeof tobjectUtils['StartEndDate']>,
      {
        startDate: Date | string
        endDate?: Date | string | number
      } & {
        [x: string]: Date
      }
    >(true)
    assertEqual<
      t.infer<typeof tobjectUtils['StartEndDate']>,
      {
        startDate: Date
        endDate?: Date
      } & { [x: string]: Date }
    >(true)
  })

  test('Employment', () => {
    assertEqual<
      t.infer<typeof tobjectUtils['Employment']>,
      | {
          kind: 'employed'
          employer: string
          position: string
          startDate: Date
          endDate?: Date
        }
      | {
          kind: 'unemployed'
          employer?: undefined
          position?: undefined
          startDate: Date
          endDate?: Date
        }
      | ({
          kind: 'retired'
          employer?: undefined
          position?: undefined
          startDate: Date
          endDate?: Date
        } & { [x: string]: Date })
    >(true)
  })

  test('Vehicle', () => {
    assertEqual<
      t.infer<typeof tobjectUtils['Vehicle']>,
      {
        kind: 'car' | 'truck' | 'motorcycle' | 'other'
        make?: string
        model?: string
        year?: number
        color?:
          | string
          | readonly [number, number, number]
          // @ts-expect-error TS-2411
          | { r: number; g: number; b: number; [x: string]: never }
      }
    >(true)
  })

  test('PersonBasicInfo', () => {
    assertEqual<
      t.infer<typeof tobjectUtils['PersonBasicInfo']>,
      {
        firstName: string
        lastName: string
        middleName?: string
        dob: Date
        age: number
        email: string
        phone: string
        ssn?: string
        gender: 'male' | 'female' | 'other'
      }
    >(true)
  })
})
