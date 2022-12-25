import cloneDeep from 'clone-deep'
import type { Except } from 'type-fest'
import { Manifest, type AnyManifest } from '../manifest_2'
import { TTypeName } from '../type-name'
import { TArray, TNullable, TOptional } from './_external'

export interface Def {
  readonly typeName: TTypeName
  readonly manifest?: AnyManifest
}

export type MakeDef<
  T extends TTypeName,
  P extends Record<string, unknown> | null = null
> = { readonly typeName: T } & Except<Def, 'typeName'> &
  (P extends null ? unknown : Readonly<P>)

export type TDef<D extends Def> = {
  readonly typeName: D['typeName']
} & Except<D, keyof Def>

export abstract class TType<O, D extends Def, I = O> {
  declare readonly $O: O
  declare readonly $I: I

  protected readonly _def: TDef<D>

  constructor(def: D) {
    const cloned = cloneDeep(def)
    this._def = cloned
  }

  abstract get manifest(): Manifest<O>

  get typeName(): D['typeName'] {
    return this._def.typeName
  }

  optional(): TOptional<this> {
    return TOptional.create(this)
  }

  nullable(): TNullable<this> {
    return TNullable.create(this)
  }

  nullish(): TOptional<TNullable<this>> {
    return this.nullable().optional()
  }

  array(): TArray<this> {
    return TArray.create(this)
  }

  isOptional(): boolean {
    return !this.manifest.required
  }

  isNullable(): boolean {
    return this.manifest.nullable
  }

  isNullish(): boolean {
    return this.isOptional() && this.isNullable()
  }

  isReadonly(): boolean {
    return this.manifest.readonly
  }
}

export type AnyTType<O = unknown, I = O> = TType<O, Def, I>
