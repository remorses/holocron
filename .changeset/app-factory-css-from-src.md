---
'@holocron.so/vite': patch
---

Fix the holocron app entry crashing with `Cannot find module './styles/globals.css'` when `@holocron.so/vite/app` is imported without the holocron Vite plugin (for example inside a `@cloudflare/vitest-pool-workers` test running in workerd).

`app-factory.tsx` now imports the stylesheet from `../src/styles/globals.css` instead of `./styles/globals.css`. Only `src/styles/globals.css` ships in the package (`tsc` does not copy `.css` into `dist/`), so the old relative import was unresolvable from the emitted `dist/app-factory.js`. The new path is stable from both `src/` and `dist/` and matches the existing `../src` convention in `vite-plugin.ts`.
