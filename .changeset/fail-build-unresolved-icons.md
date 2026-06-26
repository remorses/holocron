---
'@holocron.so/vite': patch
---

Fail production builds on unresolved icon refs. Icons referenced in `docs.json` config (navbar links, tab icons, group icons, anchor icons) and MDX frontmatter (`icon` field) are now validated during sync. If an icon name doesn't resolve (typo in lucide/fontawesome name, unsupported library), the build fails with a clear error listing all unresolved refs.

Same bypass as other content errors: set `HOLOCRON_SKIP_BUILD_ERRORS=true` to deploy anyway.
