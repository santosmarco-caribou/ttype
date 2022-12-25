import cloneDeep from 'clone-deep'

export interface PublicManifest<T> {
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

export interface Manifest<T> extends PublicManifest<T>, PrivateManifest {}

export type AnyManifest = Manifest<any>

export interface ManifestBuilderMethods<T> {
  from<U>(manifest: Manifest<U> | undefined): ManifestBuilder<U>
  setRequired(required?: boolean): ManifestBuilder<T>
  setOptional(optional?: boolean): ManifestBuilder<T>
  setNullable(nullable?: boolean): ManifestBuilder<T>
  setNullish(nullish?: boolean): ManifestBuilder<T>
  setReadonly(readonly?: boolean): ManifestBuilder<T>
}

export interface ManifestBuilder<T>
  extends Manifest<T>,
    ManifestBuilderMethods<T> {}

const withDefaults = <T>(manifest: Partial<Manifest<T>> = {}): Manifest<T> => ({
  ...manifest,
  required: manifest?.required ?? true,
  nullable: manifest?.nullable ?? false,
  readonly: manifest?.readonly ?? false,
})

const makeBuilder = <T>(
  manifest: Partial<Manifest<T>> = {}
): ManifestBuilder<T> => {
  const cloned = cloneDeep(manifest)

  const methods: ManifestBuilderMethods<T> = {
    from<U>(manifest: Manifest<U> | undefined): ManifestBuilder<U> {
      return makeBuilder(manifest)
    },
    setRequired(required = true): ManifestBuilder<T> {
      return makeBuilder({ ...cloned, required })
    },
    setOptional(optional = true): ManifestBuilder<T> {
      return this.setRequired(!optional)
    },
    setNullable(nullable = true): ManifestBuilder<T> {
      return makeBuilder({ ...cloned, nullable })
    },
    setNullish(nullish = true): ManifestBuilder<T> {
      return this.setOptional(nullish).setNullable(nullish)
    },
    setReadonly(readonly = true): ManifestBuilder<T> {
      return makeBuilder({ ...cloned, readonly })
    },
  }

  const builder = {
    ...withDefaults(cloned),
    ...methods,
  }

  const { defineProperties, fromEntries, entries } = Object

  defineProperties(
    builder,
    fromEntries(
      entries(methods).map(([k, m]) => [
        k,
        { value: m.bind(builder), enumerable: false },
      ])
    )
  )

  return builder
}

export const TManifest = makeBuilder()
