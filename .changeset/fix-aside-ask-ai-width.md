---
'@holocron.so/vite': patch
---

Keep the Ask AI widget at the full right-aside width after moving prev/next into the footer.

The per-section aside sticky wrapper is a flex-column child. `self-start` sized it to the copy-button min-content (~158px) instead of the 230px sidebar track. It now uses `w-full` so the widget matches playwriter.dev again.
