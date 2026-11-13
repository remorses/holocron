---
'@holocron.so/vite': patch
---

Fix `holocron deploy` failing with `Failed to prerender /__spiceflow/prerender-routes: 404 Not Found` on projects without a wrangler config, like a fresh template. The deploy build now gives the Cloudflare plugin a Worker entry (`spiceflow/cloudflare-entrypoint`), so the prerender step runs the real Worker instead of an assets-only one.
