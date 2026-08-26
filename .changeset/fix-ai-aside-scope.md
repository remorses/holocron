---
'@holocron.so/vite': patch
---

Render the page-level AI chat widget as a regular first-section aside. It now scrolls and unsticks with that section instead of remaining above later asides while they move underneath it.

Later authored asides remain attached to their own headings. Explicit `<Aside full>` blocks keep their full-section behavior.

Like any authored per-section aside, the widget can make a short first section taller before the next heading.
