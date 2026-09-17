---
'@holocron.so/vite': patch
---

Frost the fade under the floating Ask AI pill instead of tinting it.

The viewport band under the pill used to paint a `--background` color gradient on top of the page, so content that did not sit on the background color (images, colored blocks, dark code) got a visible tint at the bottom. It now applies a masked `backdrop-filter: blur()`, so it blurs whatever is behind it with no color wash and reads correctly over any content.

The floating pill and its frost are now **tablet and desktop only** (`lg` and up). Phones no longer render the floating Ask AI pill at all, which also removes the pill-clearance padding and the per-frame `backdrop-filter` scroll cost on touch devices.
