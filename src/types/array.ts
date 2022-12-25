import { TTypeName } from '../type-name'
import { TType, type AnyTType, type MakeDef } from './_external'

export type TArrayDef<T extends AnyTType> = MakeDef<
  TTypeName.Array,
  { readonly element: T }
>

export class TArray<T extends AnyTType> extends TType<
  T['$O'][],
  TArrayDef<T>,
  T['$I'][]
> {
  get element(): T {
    return this._def.element
  }

  static create<T extends AnyTType>(element: T): TArray<T> {
    return new TArray({
      typeName: TTypeName.Array,
      element: element,
    })
  }
}

export type AnyTArray = TArray<AnyTType>
