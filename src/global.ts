import { DEFAULT_ERROR_MAP, type ErrorMap } from './error'

export class TGlobal {
  private static _currentErrorMap: ErrorMap = DEFAULT_ERROR_MAP

  static getErrorMap(): ErrorMap {
    return this._currentErrorMap
  }

  static setErrorMap(map: ErrorMap): TGlobal {
    this._currentErrorMap = map
    return this
  }
}
