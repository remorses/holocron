---
'@holocron.so/vite': patch
---

Keep the right aside on every page in an MCP or OpenAPI tab when the site uses compact layout.

Compact stays for authored docs pages. MCP and OpenAPI tabs, including authored overview pages in those tabs, use the default three-column frame so request examples and the aside stay visible.

The left nav now spans every row of that three-column grid (`grid-row: 1 / -1`). The content frame no longer uses `overflow-y-clip`. Ask AI bottom padding now lives on `.slot-page-body`, inside the sticky containing block, so short MCP and API pages keep the nav pinned.
