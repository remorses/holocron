---
'@holocron.so/vite': patch
---

Fix footer not reaching the bottom of the viewport on short pages.

The section grid used a separate spacer row + footer row, each separated by the `--section-gap` (48px). On short pages the spacer collapsed to 0px but the extra gap still consumed space, pushing the footer below the fold. Now uses a single `minmax(max-content, 1fr)` footer row with `justify-end` to pin content to the bottom without the extra gap.
