---
'@holocron.so/vite': patch
---

Native controls now follow the site theme. Holocron sets `color-scheme: dark` when the page is dark and `color-scheme: light` otherwise, so the theme picker and version dropdown popups, form fields and scrollbars render dark on dark sites. Before, they used the browser default and showed light popups with almost invisible text on Windows and Linux. The standalone chat widget does the same.
