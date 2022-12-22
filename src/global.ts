import { getDefaultErrorMap, getDefaultIssueFormatter, type ErrorMap, type IssueFormatter } from './error'
import { utils } from './utils'

export interface TGlobalOptions {
  readonly abortEarly?: boolean
  readonly debug?: boolean
  readonly colorsEnabled?: boolean
}

export const getDefaultOptions = (): Required<TGlobalOptions> =>
  utils.cloneDeep({
    abortEarly: false,
    debug: false,
    colorsEnabled: true,
  })

export class TGlobal {
  private static _getCurrentOptions = getDefaultOptions
  private static _getCurrentErrorMap = getDefaultErrorMap
  private static _getCurrentIssueFormatter = getDefaultIssueFormatter

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
