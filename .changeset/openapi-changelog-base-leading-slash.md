---
'@holocron.so/vite': patch
---

Accept a leading slash in the OpenAPI/Changelog tab `base` slug prefix.

The `base` field on OpenAPI and Changelog tabs is a slug prefix, not a route, so generated page slugs never start with `/`. Now a leading slash is allowed and ignored, so `"/docs/api"` behaves the same as `"docs/api"`. Trailing slashes are also trimmed.

This is useful when mounting docs inside your own app via custom entry: set `base: "/docs/api"` so generated endpoints stay under `/docs/*` and don't collide with your real `/api` routes.

```jsonc
{
  "tab": "API Reference",
  "openapi": "openapi.json",
  "base": "/docs/api"
}
```
