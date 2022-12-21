import t from '../src'

export namespace tobjectUtils {
  export const Color = t
    .object({
      r: t.number(),
      g: t.number(),
      b: t.number(),
    })
    .strict()
    .or(t.tuple([t.number(), t.number(), t.number()]))
    .or(t.string())

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

  export enum PetKind {
    Cat = 'cat',
    Dog = 'dog',
    Bird = 'bird',
    Fish = 'fish',
    Other = 'other',
  }

  export const Pet = t.object({
    kind: t.enum(PetKind),
    name: t.string(),
    age: t.number(),
  })

  export const Address = t
    .object({
      kind: t.enum(['rent', 'own', 'parents', 'other']),
      street: t.array(t.string()).min(1).max(4),
      city: t.string(),
      state: t.string(),
      zip: t.string(),
    })
    .passthrough()

  export const StartEndDate = t
    .object({
      startDate: t.date().coerce('strings'),
      endDate: t.date().coerce().optional(),
    })
    .catchall(t.date().coerce(false))

  export const Employment = t
    .object({
      kind: t.literal('employed'),
      employer: t.string(),
      position: t.string(),
    })
    .extend(StartEndDate.shape)
    .or(
      t
        .object({
          kind: t.literal('unemployed'),
          employer: t.never().optional(),
          position: t.never().optional(),
        })
        .augment(StartEndDate),
      t
        .object({
          kind: t.literal('retired'),
          employer: t.never().optional(),
          position: t.never().optional(),
        })
        .merge(StartEndDate)
    )

  export const Vehicle = t
    .object({
      kind: t.enum(['car', 'truck', 'motorcycle', 'other']),
    })
    .extend(
      t
        .object({
          make: t.string(),
          model: t.string(),
          year: t.number(),
          color: Color,
        })
        .partial()
    )

  export const BasicPerson = t.object({
    firstName: t.string(),
    lastName: t.string(),
    middleName: t.string().optional(),
    dob: t.date().coerce(),
    age: t.number(),
    email: t.string(),
    phone: t.string(),
    ssn: t.string().optional(),
    gender: t.enum(['male', 'female', 'other']),
    currentAddress: Address,
    previousAddresses: t.array(Address).optional(),
    currentEmployment: Employment,
    previousEmployments: t.array(Employment).optional(),
    eyeColor: Color,
    hairColor: Color,
    vehicle: Vehicle,
    favoriteColors: t.set(Color),
    favoriteFoods: t.set(Food),
    pets: t.array(Pet).optional(),
  })

  export const Person = BasicPerson.extend({
    children: t.array(BasicPerson).nullish(),
    friends: t.array(BasicPerson).nullish(),
  })

  export const PersonBasicInfo = BasicPerson.pick([
    'firstName',
    'lastName',
    'middleName',
    'dob',
    'age',
    'email',
    'phone',
    'ssn',
    'gender',
  ])
}
