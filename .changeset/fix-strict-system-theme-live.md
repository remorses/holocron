---
'@holocron.so/vite': patch
---

Sites with `appearance.strict` now follow OS light/dark changes while the page is open. Before, the page kept the theme it loaded with until a reload, because only the theme picker listened for OS changes and strict mode hides it.
