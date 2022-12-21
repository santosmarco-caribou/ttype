import { z } from 'zod'
import { t } from './src'

const c = t.object({ a: t.null(), b: t.never() }).pick(['a', 'b'])

c.parse(2)

// z.string().parse(2)
