---
'@holocron.so/cli': patch
'@holocron.so/vite': patch
---

Fix hosted deploys breaking when `base` is set in `vite.config.ts`. Previously a site built with `base: '/docs'` emitted HTML referencing `/docs/assets/*`, but the deployment metadata had no base path, so the hosting worker looked up assets at root and every CSS/JS request 404ed — the site rendered as unstyled raw HTML.

The Vite plugin now records the resolved base in `dist/.holocron/holocron-deploy.json` during deploy builds, and `holocron deploy` automatically detects it and forwards it as the deployment `basePath` (equivalent to passing `--base-path`), so the hosting worker strips the prefix on asset lookups. An explicit `--base-path` flag still takes precedence.
