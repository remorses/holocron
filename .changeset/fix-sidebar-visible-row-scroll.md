---
'@holocron.so/vite': patch
---

Stop the left sidebar from scrolling when the active page is already in view.

The first page used to shift down a few pixels on load. `scrollIntoView({ block: nearest })` and `scroll-initial-target` still move a visible row when the nav has start `scroll-padding`. The sidebar now leaves an already-visible row alone, so the default top-aligned view stays put.
