---
'@holocron.so/vite': patch
---

Fix dev HMR for new OpenAPI and MCP pages.

Editing a spec or MCP definition now creates the new page without a
dev-server restart. Refractor grammar registration is idempotent, so the
RSC remount after a provider sync no longer crashes the module runner.
