# `ttypes`

## Table of contents

- [`ttypes`](#ttypes)
  - [Table of contents](#table-of-contents)
  - [Installation](#installation)
    - [Requirements](#requirements)
    - [From `npm`](#from-npm)
  - [Basic usage](#basic-usage)
  - [Primitives](#primitives)
  - [Literals](#literals)
  - [Enums](#enums)
    - [`enum`](#enum)
    - [`values`](#values)
    - [`extract`/`exclude`](#extractexclude)
    - [Native enums](#native-enums)
  - [Objects](#objects)
    - [`shape`](#shape)
    - [`keyof`](#keyof)
    - [`augment`/`extend`](#augmentextend)
    - [`setKey`](#setkey)
    - [`diff`](#diff)
    - [`merge`](#merge)
    - [`pick`/`omit`](#pickomit)
    - [`partial`](#partial)
    - [`required`](#required)

## Installation

### Requirements

1. TypeScript **v4.5+**
2. Enable `strict` mode in your `tsconfig.json` file

```json
{
  "compilerOptions": {
    "strict": true
  }
}
```

### From `npm`

```sh
npm install ttypes     # npm
yarn add ttypes        # yarn
pnpm add ttypes        # pnpm
bun add ttypes         # bun
```

## Basic usage

Creating a simple string schema

```ts
import { t } from 'ttypes'

// a schema to parse strings
const myStringSchema = t.string()

// parsing
myStringSchema.parse('tuna')
// => 'tuna'
myStringSchema.parse(12)
// => throws a TError

// "safe" parsing (doesn't throw on failures)
myStringSchema.safeParse('tuna')
// => { ok: true; data: 'tuna' }
myStringSchema.safeParse(12)
// => { ok: false; error: TError }
```

Creating an object schema

```ts
import { t } from 'ttypes'

const User = t.object({
  username: t.string(),
})

User.parse({ username: 'Ludwig' })

// extract the inferred type
type User = t.infer<typeof User>
// => { username: string }
```

## Primitives

```ts
import { t } from 'ttypes'

// primitive values
t.string()
t.number()
t.bigint()
t.boolean()
t.date()
t.symbol()

// empty types
t.undefined()
t.null()
t.void() // accepts undefined

// "catchall" types => allows any value
t.any()
t.unknown()

// the `never` type => allows no values
t.never()
```

## Literals

```ts
import { t } from 'ttypes'

const tuna = t.literal('tuna')
const twelve = t.literal(12)
const twobig = t.literal(2n) // bigint literal
const tru = t.literal(true)

const terrificSymbol = Symbol('terrific')
const terrific = t.literal(terrificSymbol)

// retrieve the underlying literal value
tuna.value // => 'tuna'
twelve.value // => 12
```

## Enums

```ts
import { t } from 'ttypes'

const FishEnum = t.enum(['Salmon', 'Tuna', 'Trout'])
type FishEnum = t.infer<typeof FishEnum>
// => 'Salmon' | 'Tuna' | 'Trout'
```

`t.enum()` is a `TTypes`-native way to declare a schema with a fixed set of allowable string or numeric values. Pass the array of values directly into `t.enum()`. Alternatively, use `as const` to define your enum values as a tuple of strings.

```ts
const values = ['Salmon', 'Tuna', 'Trout'] as const
const FishEnum = t.enum(values)
// => 'Salmon' | 'Tuna' | 'Trout'
```

> The following is not allowed, since we aren't able to infer the exact values of each element.
>
> ```ts
> const values = ['Salmon', 'Tuna', 'Trout']
> const FishEnum = t.enum(values)
> // => string
> ```

### `enum`

Use `.enum` to access the underlying enum values.

```ts
FishEnum.enum // => { readonly Salmon: 'Salmon'; readonly Tuna: 'Tuna'; readonly Trout: 'Trout' }
```

### `values`

Use `.values` to access the underlying enum values as an array.

```ts
FishEnum.values // => ['Salmon', 'Tuna', 'Trout']
```

### `extract`/`exclude`

Inspired by TypeScript's built-in `Extract` and `Exclude` utility types, all `TEnum`s have the `.extract()` and `.exclude()` methods that return a modified version of it.

```ts
const FishEnum = t.enum(['Salmon', 'Tuna', 'Trout'])

FishEnum.extract('Salmon') // => 'Salmon'
FishEnum.exclude('Salmon') // => 'Tuna' | 'Trout'
```

### Native enums

`t.enum()` can also be used to create schemas from native TypeScript enums.

```ts
enum FishEnum {
  Salmon = 'Salmon',
  Tuna = 'Tuna',
  Trout = 'Trout',
}

const NativeFishEnum = t.enum(FishEnum)
// => 'Salmon' | 'Tuna' | 'Trout'

NativeFishEnum.enum // => { readonly Salmon: 'Salmon'; readonly Tuna: 'Tuna'; readonly Trout: 'Trout' }
NativeFishEnum.values // => ['Salmon', 'Tuna', 'Trout']
```

## Objects

```ts
import { t } from 'ttypes'

// all properties are required by default
const Dog = t.object({
  name: t.string(),
  age: t.number(),
})

// extract the inferred type like this
type Dog = t.infer<typeof Dog>

// equivalent to:
type Dog = {
  name: string
  age: number
}
```

### `shape`

Use `.shape` to access the schemas for a particular key.

```ts
Dog.shape.name // => TString
Dog.shape.age // => TNumber
```

### `keyof`

Use `.keyof()` to create a `TEnum` schema from the keys of a `TObject`.

```ts
const keys = Dog.keyof()
/*    ^?
TEnum<{
  readonly name: 'name'
  readonly age: 'age'
}>
*/
```

### `augment`/`extend`

You can add additional fields to a `TObject` with `.augment()` or `.extend()`. Both methods are equivalent.

```ts
import { t } from 'ttypes'

const DogWithBreed = Dog.extend({
  breed: t.string(),
})
```

You can also pass an entire `TObject` to `.augment()`/`.extend()`. Only the shape of it will be considered.

```ts
import { t } from 'ttypes'

const Breed = t.object({
  breed: t.string(),
})

const DogWithBreed = Dog.extend(Breed)
```

> You can use `.augment()`/`.extend()` to overwrite fields! Be careful with this power!

### `setKey`

Use `.setKey()` to augment a `TObject` with a new field, or overwrite an existing one.

```ts
import { t } from 'ttypes'

const DogWithBreed = Dog.setKey('breed', t.string())
```

### `diff`

Use `A.diff(B)` to create a `TObject` for holding only the fields that are not present in neither `A` nor `B`.

```ts
import { t } from 'ttypes'

const Dog = t.object({
  name: t.string(),
  age: t.number(),
})

const Human = t.object({
  name: t.string(),
  age: t.number(),
  height: t.number(),
})

const Diff = Dog.diff(Human)

type Diff = t.infer<typeof Diff> // => { height: number }
```

Just like with `.augment()` and `.extend()`, you can either pass a shape or an entire `TObject` to `.diff()`.

### `merge`

Equivalent to `A.extend(B.shape)`.

```ts
import { t } from 'ttypes'

const BaseTeacher = t.object({ students: t.array(t.string()) })
const HasID = t.object({ id: t.string() })

const Teacher = BaseTeacher.merge(HasID)
type Teacher = t.infer<typeof Teacher> // => { students: string[], id: string }
```

> If the two `TObject`s share keys, the properties of `B` overrides the ones of `A`. The returned `TObject` also inherits the `unknownKeys` policy (`'strip'`/`'strict'`/`'passthrough'`) and the `catchall` schema of `B`.

### `pick`/`omit`

Inspired by TypeScript's built-in `Pick` and `Omit` utility types, all `TObject`s have the `.pick()` and `.omit()` methods that return a modified version of it. Consider this `Recipe` schema:

```ts
import { t } from 'ttypes'

const Recipe = t.object({
  id: t.string(),
  name: t.string(),
  ingredients: t.array(t.string()),
})
```

To only keep certain keys, use `.pick()`.

```ts
const JustTheName = Recipe.pick(['name']) // or: Recipe.pick('name')
type JustTheName = t.infer<typeof JustTheName>
// => { name: string }
```

To remove certain keys, use `.omit()`.

```ts
const NoIDRecipe = Recipe.omit('id')
type NoIDRecipe = t.infer<typeof NoIDRecipe>
// => { name: string, ingredients: string[] }
```

### `partial`

Inspired by the built-in TypeScript utility type `Partial`, the `.partial()` method allows for making properties of a `TObject` optional.

Starting from this object:

```ts
import { t } from 'ttypes'

const User = t.object({
  email: t.string()
  username: t.string(),
})
// => { email: string; username: string }
```

We can create a totally optional version:

```ts
const PartialUser = User.partial()
// => { email?: string; username?: string }
```

Or we can specify only some properties to make optional:

```ts
const PartialUser = User.partial(['email']) // or: user.partial('email')
// => { email?: string; username: string }
```

### `required`

Contrary to the `.partial()` method, the `.required()` method allows for making properties **required**.

Starting from this object:

```ts
import { t } from 'ttypes'

const User = t.object({
  email: t.string()
  username: t.string(),
}).partial()
// => { email?: string | undefined; username?: string | undefined }
```

We can create a totally required version:

```ts
const RequiredUser = User.required()
// => { email: string; username: string }
```

Or we can specify only some properties to make required:

```ts
const RequiredUser = User.partial('email')
// => { email: string; username?: string | undefined }
```
