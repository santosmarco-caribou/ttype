import type { AnyTType } from './_external'

export interface Unwrappable<T extends AnyTType> {
  readonly underlying: T
  unwrap(): T
  unwrapDeep(): AnyTType
}

export type AnyUnwrappable = Unwrappable<AnyTType>

export namespace Unwrappable {
  export type Unwrap<T extends AnyUnwrappable> = T['underlying']
}
