---
'@holocron.so/vite': patch
---

Make markdown tables bleed into the right margin the same way fenced code blocks do, so wide tables use the gap before the sidebar before they start scrolling.

Tables keep horizontal scroll. The shared `.bleed-right` clip rules would otherwise trap wide tables inside the prose column.
