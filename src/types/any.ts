import { TManifest, tmanifest } from '../manifest_2'
import { TTypeName } from '../type-name'
import { TType, type MakeDef } from './_external'

export type TAnyDef = MakeDef<TTypeName.Any>

export class TAny extends TType<any, TAnyDef> {
  get manifest(): TManifest<this, { required: false; nullable: true }> {
    return tmanifest({ required: false, nullable: true })
  }

  static create(): TAny {
    return new TAny({ typeName: TTypeName.Any })
  }
}
