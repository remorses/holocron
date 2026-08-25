---
'@holocron.so/vite': patch
---

Cache the request-time MDX parse so the same page source is not parsed again on every request.

Repeat views of a page now reuse the parsed tree. Cloudflare Workers with a custom domain also keep the tree in the Cache API across isolate restarts. Hosted Dynamic Workers still get the in-memory cache for a warm isolate.
