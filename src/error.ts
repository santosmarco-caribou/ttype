import { IssueKind, type NoMsgIssue } from './issues'
import type { ParseContext } from './parse'
import { utils } from './utils'

export class TError<O = unknown, I = O> extends Error {
  readonly name = 'TError'

  readonly issues = this._parseCtx.allIssues

  constructor(private readonly _parseCtx: ParseContext<unknown, O, I>) {
    super()

    const actualProto = new.target.prototype
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto)
    } else {
      // prettier-ignore
      (this as any).__proto__ = actualProto
    }

    // Object.getOwnPropertyNames(this).forEach((prop) =>
    //   Object.defineProperty(this, prop, { enumerable: false })
    // )
  }

  get message() {
    console.log(this.issues)
    return JSON.stringify(this.issues, null, 2)
  }
}

export interface ErrorMapContext {
  readonly defaultMessage: string
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

export const DEFAULT_ERROR_MAP: ErrorMapFn = (issue) => {
  const makeMinMaxElementsCheckMsg = (
    params: {
      typeName: 'Array' | 'Set' | 'Tuple'
      value: number
    } & (
      | { kind: 'min' | 'max'; inclusive: boolean }
      | { kind: 'len' | 'size'; inclusive?: never }
    )
  ) =>
    `${params.typeName} must contain ${
      params.inclusive
        ? { min: 'at least', max: 'at most' }[params.kind]
        : {
            min: 'more than',
            max: 'less than',
            len: 'exactly',
            size: 'exactly',
          }[params.kind]
    } ${utils.intToLiteral(params.value)} ${utils.pluralize(
      'element',
      params.value
    )}`

  switch (issue.kind) {
    case IssueKind.Required:
      return 'Required'
    case IssueKind.InvalidType:
      return `Expected ${issue.payload.expected}, got ${issue.payload.received}`
    case IssueKind.InvalidArray:
      switch (issue.payload.kind) {
        case 'min':
        case 'max':
        case 'len':
          return makeMinMaxElementsCheckMsg({
            typeName: 'Array',
            ...issue.payload,
          })
        case 'sort_ascending':
        case 'sort_descending':
          return `Array must be sorted in ${utils.replaceAll(
            issue.payload.kind,
            'sort_',
            ''
          )} order`
      }
    case IssueKind.InvalidDate:
      switch (issue.payload.kind) {
        case 'min':
        case 'max':
          return `Date must be ${issue.payload.inclusive ? 'on or ' : ''}${
            issue.payload.kind === 'min' ? 'after' : 'before'
          } ${issue.payload.value}`
        case 'range':
          return `Date must be between ${issue.payload.min} (${
            ['min', 'both'].includes(issue.payload.inclusive)
              ? 'inclusive'
              : 'exclusive'
          }) and ${issue.payload.max} (${
            ['max', 'both'].includes(issue.payload.inclusive)
              ? 'inclusive'
              : 'exclusive'
          })`
      }
    case IssueKind.InvalidSet:
      return makeMinMaxElementsCheckMsg({ typeName: 'Set', ...issue.payload })
    case IssueKind.InvalidTuple:
      return makeMinMaxElementsCheckMsg({ typeName: 'Tuple', ...issue.payload })
    case IssueKind.InvalidEnumValue:
      return `Expected one of ${issue.payload.expected.formatted}, got ${issue.payload.received.formatted}`
    case IssueKind.InvalidLiteral:
      return `Expected the literal value ${issue.payload.expected.formatted}, got ${issue.payload.received.formatted}`
    case IssueKind.InvalidUnion:
      return '<<TODO>>'
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
      return 'Invalid input'
  }
}
