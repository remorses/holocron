---
'@holocron.so/vite': patch
---

Keep the Ask AI widget at the top of the right sidebar on pages with no asides, and on pages with a single `<Aside full>`.

The widget now uses a page-spanning `<Aside full>` in those cases, so it stays aligned with the top of the page instead of unsticking with the first heading. Pages with other per-section asides are unchanged: the widget still sits in the first section, and later asides stay next to their own headings.
