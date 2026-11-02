# No page cache, full sync on every save (human)

- User, 2026-11-02: asked "so is this worth it or not?", then "commit." after the
  recommendation to accept slower HMR and not add a single-page reprocess path.
- Every build and every dev save processes every page. No disk or in-memory reuse of
  processed MDX.
- Why: ~0.2 to 0.4 ms per page with mdastic. Invalidation (imports, images, nav titles,
  cross-page link checks, icons) was the source of stale-cache bugs.
- Lost: dev HMR on realworld-polar (258 pages) went from ~120-160 ms to ~200-245 ms. A
  "reprocess only the edited page" path was rejected because it brings invalidation back.
- Open: if large sites (1000+ pages) feel slow, make the full sync faster (safe-mdx
  validation ~25 ms on polar, transform passes) instead of adding a cache.
- Lives in: `vite/src/lib/sync.ts`, `vite/src/vite-plugin.ts` (`hotUpdate`).
