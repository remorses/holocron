// Custom entry: mounts holocron as a child of a user Spiceflow app.
// Add custom routes, middleware, or layouts above the .use(holocronApp) call.

import { Spiceflow } from 'spiceflow'
import { app as holocronApp } from '@holocron.so/vite/app'

export const app = new Spiceflow().use(holocronApp)

app.listen(Number(process.env.PORT || 3000))
