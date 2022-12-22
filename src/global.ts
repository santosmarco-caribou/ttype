import { DEFAULT_ERROR_MAP, DEFAULT_ISSUE_FORMATTER, IssueFormatter, type ErrorMap } from './error'
import { utils } from './utils'

export interface TGlobalOptions {
  readonly abortEarly?: boolean
  readonly debug?: boolean
  readonly colorsEnabled?: boolean
}

export const DEFAULT_GLOBAL_OPTIONS: Required<TGlobalOptions> = {
  abortEarly: false,
  debug: false,
  colorsEnabled: true,
}

export class TGlobal {
  private static _getCurrentOptions: () => Required<TGlobalOptions> = () => DEFAULT_GLOBAL_OPTIONS
  private static _getCurrentErrorMap: () => ErrorMap = () => DEFAULT_ERROR_MAP
  private static _getCurrentIssueFormatter: () => IssueFormatter = () => DEFAULT_ISSUE_FORMATTER

  static getOptions(): Required<TGlobalOptions> {
    return utils.cloneDeep(this._getCurrentOptions())
  }

  static setOptions(options: TGlobalOptions): TGlobal {
    const currOptions = this._getCurrentOptions()
    this._getCurrentOptions = () => ({ ...currOptions, ...options })
    return this
  }

  static getErrorMap(): ErrorMap {
    return this._getCurrentErrorMap()
  }

  static setErrorMap(map: ErrorMap): TGlobal {
    this._getCurrentErrorMap = () => map
    return this
  }

  static getIssueFormatter(): IssueFormatter {
    return this._getCurrentIssueFormatter()
  }

  static setIssueFormatter(formatter: IssueFormatter): TGlobal {
    this._getCurrentIssueFormatter = () => formatter
    return this
  }
}
