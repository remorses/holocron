---
'@holocron.so/vite': patch
---

OpenAPI endpoint pages no longer render Path, Header, and Cookie Parameters sections. Path params are already visible in the endpoint path shown at the top of the page, and header/cookie params are internal plumbing better documented in the endpoint description. Only Query Parameters and Request Body keep dedicated sections.
