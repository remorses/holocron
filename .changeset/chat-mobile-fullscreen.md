---
'@holocron.so/vite': patch
---

Make the AI chat drawer fill the screen on mobile, with no inset gap.

The floating pill no longer overflows when focused: its width is capped to the viewport instead of `100vw`. On phones the open chat is edge to edge; desktop still uses the rounded side panel.
