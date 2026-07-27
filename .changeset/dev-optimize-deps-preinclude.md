---
'@holocron.so/vite': patch
---

Fix transient 500 ("There is a new version of the pre-bundle") on the first dev server requests. The SSR optimizer discovered `motion/react` mid-request on the first page render, re-optimized, and invalidated in-flight module graphs. The dep is now pre-included in `optimizeDeps` for the SSR and client environments (along with `github-slugger` and `@radix-ui/react-dropdown-menu`), eliminating the post-startup "optimized dependencies changed. reloading" churn.
