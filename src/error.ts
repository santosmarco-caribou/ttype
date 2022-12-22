import { bold, cyan, dim, italic, magenta } from 'colorette'
import { inspect } from 'util'
import { TGlobal } from './global'
import { IssueKind, type Issue, type NoMsgIssue } from './issues'
import type { ParseContext } from './parse'
import type { AnyTType } from './types'
import { utils } from './utils'

export type FormattedError<I, U = string> = {
  readonly _errors: readonly U[]
} & (NonNullable<I> extends readonly [unknown, ...unknown[]]
  ? { readonly [K in keyof NonNullable<I>]?: FormattedError<NonNullable<I>[K]> }
  : NonNullable<I> extends readonly unknown[]
  ? { readonly [x: number]: FormattedError<NonNullable<I>[number]> }
  : NonNullable<I> extends object
  ? { readonly [K in keyof NonNullable<I>]?: FormattedError<NonNullable<I>[K]> }
  : unknown)

export interface FlattenedError<I, U = string> {
  readonly formErrors: readonly U[]
  readonly fieldErrors: {
    readonly [K in I extends unknown ? keyof I : never]?: readonly U[]
  }
}

export type inferFormattedError<T extends AnyTType, U = string> = utils.Simplify<
  FormattedError<T['_I'], U>
>
export type inferFlattenedError<T extends AnyTType, U = string> = utils.Simplify<
  FlattenedError<T['_I'], U>
>

export class TError<O = unknown, I = O> extends Error {
  readonly name = 'TError'

  constructor(private readonly _parseCtx: ParseContext<unknown, O, I>) {
    super()

    const actualProto = new.target.prototype
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto)
    } else {
      // prettier-ignore
      (this as any).__proto__ = actualProto
    }
  }

  get issues() {
    return this._parseCtx.issues
  }

  get message() {
    return '\n\n' + this.issues.map(TGlobal.getIssueFormatter()).join('')
  }

  toString() {
    return this.message
  }

  format(): FormattedError<I>
  format<U>(mapper: (issue: Issue) => U): FormattedError<I, U>
  format<U>(mapper: (issue: Issue) => U = (issue) => issue.message as U) {
    const fieldErrors = { _errors: [] } as unknown as FormattedError<I, U>
    const processError = (error: TError) => {
      for (const issue of error.issues) {
        if (
          issue.kind === IssueKind.InvalidArguments ||
          issue.kind === IssueKind.InvalidReturnType
        ) {
          processError(issue.payload.error)
        } else if (issue.path.length === 0) {
          // prettier-ignore
          (fieldErrors._errors as U[]).push(mapper(issue))
        } else {
          let curr = fieldErrors as any
          let i = 0

          while (i < issue.path.length) {
            const el = issue.path[i]
            const terminal = i === issue.path.length - 1

            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] }
            } else {
              curr[el] = curr[el] || { _errors: [] }
              curr[el]._errors.push(mapper(issue))
            }

            curr = curr[el]
            i++
          }
        }
      }
    }
    processError(this)
    return fieldErrors
  }

  flatten(): FlattenedError<I>
  flatten<U>(mapper: (issue: Issue) => U): FlattenedError<I, U>
  flatten<U>(mapper: (issue: Issue) => U = (issue) => issue.message as U) {
    const fieldErrors = {} as Record<string | number, U[]>
    const formErrors: U[] = []
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || []
        fieldErrors[sub.path[0]].push(mapper(sub))
      } else {
        formErrors.push(mapper(sub))
      }
    }
    return { formErrors, fieldErrors }
  }
}

/* ---------------------------------------------------------------------------------------------- */
/*                                         IssueFormatter                                         */
/* ---------------------------------------------------------------------------------------------- */

export type IssueFormatter = (issue: Issue) => string

export const DEFAULT_ISSUE_FORMATTER: IssueFormatter = (issue) => {
  const c = (fn: (text: string) => string, text: string) =>
    TGlobal.getOptions().colorsEnabled ? fn(text) : text

  const header = [
    c(magenta, `[${issue.kind}]`),
    c(cyan, c(bold, issue.type.name)),
    '•',
    c(bold, issue.message),
    c(dim, issue.path.length > 0 ? `${c(italic, 'at path:')} "${issue.path.join('.')}"` : ''),
  ]

  return `${header.join(' ')}\n${inspect(utils.pick(issue, ['payload', 'input', 'type', '_meta']), {
    depth: Infinity,
    colors: TGlobal.getOptions().colorsEnabled,
  })}\n\n`
}

/* ---------------------------------------------------------------------------------------------- */
/*                                            ErrorMap                                            */
/* ---------------------------------------------------------------------------------------------- */

export interface ErrorMapContext {
  readonly defaultMsg: string
}

export type ErrorMapFn<K extends IssueKind = IssueKind> = (
  issue: NoMsgIssue<K>,
  ctx: ErrorMapContext
) => string

export type ErrorMapDict = utils.Simplify<
  { readonly [K in IssueKind as `${K}`]?: string | ErrorMapFn<K> } & {
    readonly __default?: string | ErrorMapFn
  }
>

export type ErrorMap = ErrorMapFn | ErrorMapDict

export const resolveErrorMap = (map: ErrorMap): ErrorMapFn => {
  if (typeof map === 'function') {
    return map
  }
  return (issue, ctx) => {
    const fnOrStr = map[issue.kind] ?? map.__default ?? DEFAULT_ERROR_MAP
    if (typeof fnOrStr === 'string') {
      return fnOrStr
    } else {
      return (fnOrStr as ErrorMapFn)(issue, ctx)
    }
  }
}

export const DEFAULT_ERROR_MAP: ErrorMapFn = (issue, ctx) => {
  const makeMinMaxElementsCheckMsg = (
    params: {
      typeName: 'Array' | 'Set' | 'Tuple'
      value: number
    } & (
      | { check: 'min' | 'max'; inclusive: boolean }
      | { check: 'len' | 'size'; inclusive?: never }
    )
  ) =>
    `${params.typeName} must contain ${
      params.inclusive
        ? { min: 'at least', max: 'at most' }[params.check]
        : { min: 'more than', max: 'less than', len: 'exactly', size: 'exactly' }[params.check]
    } ${utils.intToLiteral(params.value)} ${utils.pluralize('element', params.value)}`

  switch (issue.kind) {
    case IssueKind.Required:
      return 'Required'
    case IssueKind.InvalidType:
      return `Expected ${issue.payload.expected}, got ${issue.payload.received}`
    case IssueKind.InvalidArray:
      switch (issue.payload.check) {
        case 'min':
        case 'max':
        case 'len':
          return makeMinMaxElementsCheckMsg({ typeName: 'Array', ...issue.payload })
        case 'sort_ascending':
        case 'sort_descending':
          return `Array must be sorted in ${utils.replaceAll(
            issue.payload.check,
            'sort_',
            ''
          )} order`
      }
    case IssueKind.InvalidDate:
      switch (issue.payload.check) {
        case 'min':
        case 'max':
          return `Date must be ${issue.payload.inclusive ? 'on or ' : ''}${
            issue.payload.check === 'min' ? 'after' : 'before'
          } ${issue.payload.value}`
        case 'range':
          return `Date must be between ${issue.payload.min} (${
            ['min', 'both'].includes(issue.payload.inclusive) ? 'inclusive' : 'exclusive'
          }) and ${issue.payload.max} (${
            ['max', 'both'].includes(issue.payload.inclusive) ? 'inclusive' : 'exclusive'
          })`
      }
    case IssueKind.InvalidSet:
      return makeMinMaxElementsCheckMsg({ typeName: 'Set', ...issue.payload })
    case IssueKind.InvalidTuple:
      return makeMinMaxElementsCheckMsg({ typeName: 'Tuple', ...issue.payload })
    case IssueKind.InvalidEnumValue:
      return `Expected input to be one of ${issue.payload.expected.formatted}, got ${issue.payload.received.formatted}`
    case IssueKind.InvalidLiteral:
      return `Expected the literal value ${issue.payload.expected.formatted}, got ${issue.payload.received.formatted}`
    case IssueKind.InvalidArguments:
      return 'Invalid function argument(s)'
    case IssueKind.InvalidReturnType:
      return 'Invalid return type'
    case IssueKind.InvalidUnion:
      return `Expected input to match one of: ${issue.type.hint}`
    case IssueKind.InvalidIntersection:
      return 'Intersection results could not be merged'
    case IssueKind.InvalidInstance:
      return `Expected an instance of ${issue.payload.expected.className}`
    case IssueKind.UnrecognizedKeys:
      return `Unrecognized ${utils.pluralize(
        'key',
        issue.payload.keys.length
      )} in object: ${issue.payload.keys.map(utils.literalize).join(', ')}`
    case IssueKind.Forbidden:
      return 'Forbidden'
    case IssueKind.Custom:
      return issue.payload.message ?? 'Custom validation failed'

    default:
      return ctx.defaultMsg || 'Invalid input'
  }
}
