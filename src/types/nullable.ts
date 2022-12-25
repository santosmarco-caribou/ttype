import { TManifest } from '../manifest'
import { TTypeName } from '../type-name'
import {
  TType,
  type AnyTType,
  type MakeDef,
  type Unwrappable,
} from './_external'

export type TNullableDef<T extends AnyTType> = MakeDef<
  TTypeName.Nullable,
  { readonly underlying: T }
>

export class TNullable<T extends AnyTType>
  extends TType<T['$O'] | null, TNullableDef<T>, T['$I'] | null>
  implements Unwrappable<T>
{
  get underlying(): T {
    return this._def.underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): UnwrapTNullableDeep<T> {
    if (this.underlying instanceof TNullable) {
      return this.underlying.unwrapDeep()
    }
    return this.underlying as UnwrapTNullableDeep<T>
  }

  static create<T extends AnyTType>(underlying: T): TNullable<T> {
    return new TNullable({
      typeName: TTypeName.Nullable,
      underlying,
      manifest: TManifest.from(underlying.manifest).setNullable(),
    })
  }
}

export type AnyTNullable = TNullable<AnyTType>

export type UnwrapTNullableDeep<T extends AnyTType> = T extends TNullable<
  infer U
>
  ? UnwrapTNullableDeep<U>
  : T
