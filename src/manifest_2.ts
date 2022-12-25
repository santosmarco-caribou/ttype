import type { AnyTType } from './types/_external'
import { utils } from './utils'

export interface PublicManifest<T = any> {
  readonly title?: string
  readonly summary?: string
  readonly description?: string
  readonly version?: string
  readonly examples?: readonly T[]
  readonly tags?: readonly string[]
  readonly notes?: readonly string[]
  readonly unit?: string
  readonly deprecated?: boolean
  readonly meta?: Record<string, unknown>
}

export interface PrivateManifest {
  readonly required: boolean
  readonly nullable: boolean
  readonly readonly: boolean
}

export interface Manifest<T = any> extends PublicManifest<T>, PrivateManifest {}

export interface ManifestDefaults extends PrivateManifest {
  readonly required: true
  readonly nullable: false
  readonly readonly: false
}

export type TManifest<
  T extends AnyTType,
  M extends Partial<Manifest<T['$O']>>
> = Readonly<utils.Merge<utils.Merge<Manifest<T['$O']>, ManifestDefaults>, M>>

export const tmanifest = <
  T extends AnyTType,
  M extends Partial<Manifest<T['$O']>>
>(
  manifest: M
): TManifest<T, M> => {
  return utils.merge(
    { required: true, nullable: false, readonly: false } as const,
    manifest
  )
}

tmanifest.from = <T extends AnyTType>(type: T): TManifest<T, T['manifest']> =>
  tmanifest<T, T['manifest']>(type.manifest)

tmanifest.with = <T extends AnyTType, M extends Partial<Manifest<T['$O']>>>(
  manifest: M
): TManifest<T, M> => tmanifest(manifest)
