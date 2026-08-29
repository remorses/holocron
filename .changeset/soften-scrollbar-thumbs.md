---
'@holocron.so/vite': patch
---

Make scrollbar thumbs more subtle in light and dark mode.

Hover used `--alpha()` on colors that already had alpha, which replaced the alpha and produced a bright thumb. Thumbs now mix opaque `--foreground` at 12% (22% on hover).
