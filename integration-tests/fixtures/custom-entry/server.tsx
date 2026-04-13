// Custom-entry fixture: mounts holocron on top of a user Spiceflow app
// with user API routes, a user .page/.layout, and custom middleware.

import { Spiceflow } from 'spiceflow'
import { app as holocronApp } from '@holocron.so/vite/app'

export const app = new Spiceflow()
  .use(async ({ request }, next) => {
    const res = await next()
    if (res) res.headers.set('x-user-middleware', 'ran')
    return res
  })
  .get('/api/hello', () => ({ hello: 'world' }))
  .get('/api/echo/:name', ({ params }) => ({ name: params.name }))
  .layout('/custom-user-page', ({ children }) => (
    <html lang='en' data-user-layout='yes'>
      <head><title>Custom User Page</title></head>
      <body>
        <header data-user-header='yes'>User Layout</header>
        {children}
      </body>
    </html>
  ))
  .page('/custom-user-page', () => (
    <main data-user-page='yes'>
      <h1>This page is owned by the user, not holocron.</h1>
    </main>
  ))
  .use(holocronApp)

app.listen(Number(process.env.PORT || 3000))
