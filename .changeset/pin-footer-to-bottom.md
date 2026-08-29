---
'@holocron.so/vite': patch
---

Pin the site footer to the bottom of the viewport on short pages.

Short docs pages (MCP tools, resources, and similar) no longer leave a gap below the footer. The page shell fills the window with flex grow instead of `min-h-screen`, and the content area grows so the footer sits at the bottom. Long pages still scroll normally.
