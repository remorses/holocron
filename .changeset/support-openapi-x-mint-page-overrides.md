---
'@holocron.so/vite': minor
---

Add support for Mintlify's operation-level `x-mint` page overrides in OpenAPI specs.

Holocron now uses `x-mint.title`, `x-mint.sidebarTitle`, and `x-mint.description` for generated endpoint pages. It also renders `x-mint.content`, including badges and other compatible MDX components, between the endpoint description and parameter sections.
