---
'@holocron.so/vite': patch
---

Keep left-sidebar TOC headings tight.

Page and group rows still use `--sidebar-row-padding-y` for the hover pill. Heading links under the active page override that to `padding-block: 0`, so TOC sections match the denser spacing from before the padding restore.
