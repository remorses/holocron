---
'@holocron.so/vite': patch
---

Fix Cloudflare Workers deploys 404ing every asset when `base` is set in `vite.config.ts`. A site built with `base: '/docs'` emits HTML referencing `/docs/assets/app.js`, but Cloudflare's Asset Worker resolves requests against the uploaded directory tree and deliberately does not strip the base ([cloudflare/workers-sdk#11857](https://github.com/cloudflare/workers-sdk/issues/11857)), so it only had `assets/app.js`. Every script, stylesheet, font, and image failed and the deployed site rendered unstyled.

The client build output is now nested under a folder named after the base whenever the Cloudflare plugin is in use, which is the layout Cloudflare documents for serving a subdirectory. `/docs/assets/app.js` resolves straight from the CDN with no extra Worker invocation and no `ASSETS` binding to configure. Node deploys and `holocron deploy` are unchanged.
