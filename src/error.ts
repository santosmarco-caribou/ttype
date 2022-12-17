import type { ParseContext } from './parse'

export class TError<O = unknown, I = O> extends Error {
  readonly name = 'TError'

  readonly issues = this._parseCtx.allIssues

  constructor(private readonly _parseCtx: ParseContext<unknown, O, I>) {
    super()
  }
}
