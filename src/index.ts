// import * as t from './_external'
// export * from './_external'
// export { t }
// export default t

import * as _t from './types/_external'
export * from './types/_external'

export const t = {
  ..._t,
  any: _t.TAny.create,
  array: _t.TArray.create,
  nullable: _t.TNullable.create,
  optional: _t.TOptional.create,
  unknown: _t.TUnknown.create,
}

export default t
