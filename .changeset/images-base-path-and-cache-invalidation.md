---
'@holocron.so/vite': patch
---

Fix images breaking when a Vite `base` path is configured, plus stale image cache after moving or editing files. Images resolved from `public/` (e.g. `/images/inbox.png`) and copied `/_holocron/images/<hash>` paths are now prefixed with the Vite base at render time (`Image`, `LazyVideo`, `Card img`, and frontmatter `og:image`/`twitter:image` meta tags), so a site served under `base: '/docs'` no longer 404s on images. The page cache key now also includes each image's resolution state (resolved file path, whether it needs copying, and content hash), so moving an image between the project root and `public/` — or replacing its pixels in place — invalidates the cache instead of serving stale paths until `dist/` is deleted.
