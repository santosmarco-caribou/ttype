import t from '../src'
import { assertEqual } from './_utils'

describe('TObject :: pick/omit', () => {
  const Fish = t.object({
    name: t.string(),
    age: t.number(),
    nested: t.object({}),
  })

  describe('pick', () => {
    test('passes', () => {
      Fish.pick('name').parse({ name: '12' })
      Fish.pick('name').parse({ name: 'bob', age: 12 })
      Fish.pick('age').parse({ age: 12 })
      const NameOnlyFish = Fish.pick('name')
      NameOnlyFish.parse({ name: 'bob' })
    })

    test('fails', () => {
      const NameOnlyFish = Fish.pick('name').strict()
      expect(() => NameOnlyFish.parse({ name: 12 })).toThrow()
      expect(() => NameOnlyFish.parse({ name: 'bob', age: 12 })).toThrow()
      expect(() => NameOnlyFish.parse({ age: 12 })).toThrow()
    })

    test('inference', () => {
      const NameOnlyFish = Fish.pick('name')
      type NameOnlyFish = t.infer<typeof NameOnlyFish>
      assertEqual<NameOnlyFish, { name: string }>(true)
    })
  })

  describe('omit', () => {
    test('passes', () => {
      Fish.omit('name').parse({ age: 12, nested: {} })
    })

    test('fails', () => {
      const NoNameFish = Fish.omit('name')
      expect(() => NoNameFish.parse({ name: 12 })).toThrow()
      expect(() => NoNameFish.parse({ age: 12 })).toThrow()
      expect(() => NoNameFish.parse({})).toThrow()
    })

    test('inference', () => {
      const NoNameFish = Fish.omit('name')
      type NoNameFish = t.infer<typeof NoNameFish>
      assertEqual<NoNameFish, { age: number; nested: {} }>(true)
    })
  })
})
