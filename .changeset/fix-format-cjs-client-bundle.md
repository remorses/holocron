---
'@holocron.so/vite': patch
---

Remove `'use client'` from OpenAPI endpoint renderer to keep `safe-mdx` parsing server-side.

The `render-openapi.tsx` component was incorrectly marked as a client component despite using
zero client-only APIs (no hooks, no browser globals). This pulled `safe-mdx` and its transitive
dependency chain (`remark-frontmatter` → `micromark-extension-frontmatter` → `fault` → `format`)
into the client bundle, causing a Vite dev server error:

```
The requested module "format/format.js" does not provide an export named "default"
```

The `format` package (v0.2.2, last updated 2013) is CJS-only and Vite cannot convert its
`module.exports = fn` IIFE pattern to an ESM default export in the browser.

The fix removes the `'use client'` directive so `OpenAPIEndpoint` renders as a server component.
Interactive children like `Expandable` are already their own `'use client'` boundaries.
