# Keep the request-time MDX memoize (human)

- User, 2026-11-02: "let's keep #memoize for stuff in prod even if saves little".
- `parsePageMdx` in `app-factory.tsx` keeps going through `#memoize` (isolate LRU + Cache
  API on workerd). Do not delete it to simplify the pipeline.
- Why: production request CPU on Workers is billed and capped; any saved parse is worth it.
- Lost: deleting `memoize-node.ts`, `memoize-workerd.ts`, the `#memoize` imports map and
  `rememberCacheOrigin`. Measured with mdastic: parse 0.05 to 0.09 ms per page, key hash
  0.03 to 0.04 ms, so the saving is small.
- Open: none.
- Lives in: `vite/src/lib/memoize-node.ts`, `vite/src/lib/memoize-workerd.ts`,
  `vite/src/app-factory.tsx`, `vite/package.json` (`#memoize`).
