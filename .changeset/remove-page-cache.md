---
'@holocron.so/vite': minor
---

**Every build and dev sync now processes every page, and the page cache is gone.** MDX parsing got fast enough (about 0.2 ms per page) that reusing processed pages from `dist/` was no longer worth its complexity and stale-cache bugs. A 258-page site syncs in about 100 ms.

- The `pageCache` plugin option is removed. Delete it from your `vite.config.ts`.
- `dist/holocron-cache.json` and `dist/holocron-mdx.json` are no longer written. Icon SVGs are cached in `dist/holocron-icons.json` and image sizes in `dist/holocron-images.json`.
- `NavPage.gitSha` is removed from the navigation data.
