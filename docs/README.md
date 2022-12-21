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
const myStringSchema = z.string()

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

const UserSchema = t.object({
  username: t.string(),
})

UserSchema.parse({ username: 'Ludwig' })

// extract the inferred type
type User = z.infer<typeof UserSchema>
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
