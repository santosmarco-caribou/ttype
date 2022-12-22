import { getDefaultErrorMap, getDefaultIssuesFormatter, type ErrorMap, type IssuesFormatter } from './error'
import { utils } from './utils'

export interface TGlobalOptions {
  readonly abortEarly?: boolean
  readonly debug?: boolean
  readonly colors?: boolean
}

export const getDefaultOptions = (): Required<TGlobalOptions> =>
  utils.cloneDeep({
    abortEarly: false,
    debug: false,
    colors: true,
  })

export class TGlobal {
  private static _getCurrentOptions = () => getDefaultOptions()
  private static _getCurrentErrorMap = () => getDefaultErrorMap()
  private static _getCurrentIssuesFormatter = () => getDefaultIssuesFormatter()

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

  static getIssuesFormatter(): IssuesFormatter {
    return this._getCurrentIssuesFormatter()
  }

  static setIssuesFormatter(formatter: IssuesFormatter): TGlobal {
    this._getCurrentIssuesFormatter = () => formatter
    return this
  }
}
