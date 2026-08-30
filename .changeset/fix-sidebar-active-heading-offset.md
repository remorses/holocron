---
'@holocron.so/vite': patch
---

Fix the left sidebar highlighting the wrong heading while you scroll.

The active section now tracks the sticky header line (`scroll-margin-top`) instead of a fixed 50px offset. Hash links park a heading on that line (~144px), so the old offset kept the previous heading active and the sidebar jumped backwards.
