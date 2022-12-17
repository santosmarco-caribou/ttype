import { t } from './src'

console.log(t.object({ a: t.null(), b: t.never() }).pick(['a', 'b']))
