import { TManifest, tmanifest } from '../manifest_2'
import { TTypeName } from '../type-name'
import { TType, type MakeDef } from './_external'

export type TUnknownDef = MakeDef<TTypeName.Unknown>

export class TUnknown extends TType<unknown, TUnknownDef> {
  get manifest(): TManifest<this, { required: false; nullable: true }> {
    return tmanifest({ required: false, nullable: true })
  }

  static create(): TUnknown {
    return new TUnknown({ typeName: TTypeName.Unknown })
  }
}
