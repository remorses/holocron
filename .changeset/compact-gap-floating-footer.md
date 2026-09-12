---
'@holocron.so/vite': patch
---

Keep the floating Ask AI pill off the footer.

The fade pad under the pill used to sit on the page, so it looked like random empty space. Floating Ask AI now adds **60px** of padding under the footer only, including on pages that render the pill without `data-assistant-display="floating"`.
