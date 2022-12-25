import { TManifest, tmanifest } from '../manifest_2'
import { TTypeName } from '../type-name'
import { utils } from '../utils'
import {
  TType,
  type AnyTType,
  type MakeDef,
  type Unwrappable,
} from './_external'

export type TOptionalDef<T extends AnyTType> = MakeDef<
  TTypeName.Optional,
  { readonly underlying: T }
>

export class TOptional<T extends AnyTType>
  extends TType<T['$O'] | undefined, TOptionalDef<T>, T['$I'] | undefined>
  implements Unwrappable<T>
{
  get manifest(): TManifest<
    this,
    utils.Merge<T['manifest'], { required: false }>
  > {
    return tmanifest
      .from(this.underlying)
      .with({ ...this.underlying.manifest, required: false })
  }

  get underlying(): T {
    return this._def.underlying
  }

  unwrap(): T {
    return this.underlying
  }

  unwrapDeep(): UnwrapTOptionalDeep<T> {
    if (this.underlying instanceof TOptional) {
      return this.underlying.unwrapDeep()
    }
    return this.underlying as UnwrapTOptionalDeep<T>
  }

  static create<T extends AnyTType>(underlying: T): TOptional<T> {
    return new TOptional({ typeName: TTypeName.Optional, underlying })
  }
}

export type AnyTOptional = TOptional<AnyTType>

export type UnwrapTOptionalDeep<T extends AnyTType> = T extends TOptional<
  infer U
>
  ? UnwrapTOptionalDeep<U>
  : T
