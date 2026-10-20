---
'@holocron.so/vite': patch
---

Fix dark mode switching back to light when navigating client-side to a prerendered page like `/`. The `.dark` class on `<html>` is now set only by the blocking theme script, so a page rendered without the theme cookie can no longer remove it.
