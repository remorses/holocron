---
'@holocron.so/vite': minor
---

Show all response statuses with examples in the OpenAPI sidebar, not just the first 2xx.

Previously only one response status was shown in the Response example panel (the first 2xx with examples, or the first response with any). Now every status that defines `example` or `examples` gets its own tab(s).

When multiple statuses have examples, tab titles are prefixed with the status code for clarity:

```
Response example
├── 201 — Success A
├── 201 — Success B
├── 401 — No token
└── 401 — Bad token
```

When only one status has examples, titles stay clean with no prefix.

Closes #98
