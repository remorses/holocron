// Docs-subfolder fixture: parent app owns `/` while holocron serves `/docs/*`.
// Verifies that holocron does NOT redirect `/` when the parent has its own page.

import { Spiceflow } from 'spiceflow'
import { app as holocronApp } from '@holocron.so/vite/app'

export const app = new Spiceflow()
  .page('/', () => (
    <html lang='en'>
      <head><title>Product Homepage</title></head>
      <body>
        <main data-homepage='yes'>
          <h1>Welcome to the Product</h1>
          <p>This is the product homepage, not docs.</p>
          <a href='/docs/getting-started'>Read the docs</a>
        </main>
      </body>
    </html>
  ))
  .use(holocronApp)

void app.listen(Number(process.env.PORT || 3000))

export default {
  fetch(request: Request) {
    return app.handle(request)
  },
}
