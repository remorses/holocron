---
'@holocron.so/vite': patch
---

Strip HTTP method from OpenAPI sidebar labels.

The sidebar already shows a colored method badge (GET, POST, etc.) next to each endpoint.
The text label now omits the method to avoid redundancy. The SEO `<title>` and page H1
keep the full `METHOD /path` fallback for discoverability.

Only affects operations without a `summary` or `operationId` in the spec. When either
field is present, the title is unchanged.
