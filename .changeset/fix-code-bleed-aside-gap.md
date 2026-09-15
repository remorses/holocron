---
'@holocron.so/vite': patch
---

Keep code-block bleed from touching the right sidebar.

When `layout.columnGap` is as tight as the default 32px bleed, fenced code used to fill the entire gutter and sit flush against the Ask AI widget. Bleed now leaves a 16px gap between bled content and the adjacent column. Sites that keep the default 60px gap are unchanged.
