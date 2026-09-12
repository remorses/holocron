---
'@holocron.so/vite': patch
---

Keep the floating Ask AI pill off the footer.

The fade pad under the pill was 8rem, so the footer could sit under the chat input. Floating Ask AI now uses 12rem of bottom padding, including on pages that render the pill without `data-assistant-display="floating"`.
