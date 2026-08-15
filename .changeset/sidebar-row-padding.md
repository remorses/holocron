---
'@holocron.so/vite': patch
---

Give sidebar nav rows more padding inside the hover and active pill.

The highlight used to hug the label with no vertical padding and only `6px`
on the sides. Rows now use `--sidebar-row-padding-y` (`4px`) and a slightly
wider `--sidebar-row-padding-x` (`8px`). `--sidebar-row-gap` drops from
`10px` to `4px` so the space between items stays about the same.

Override the tokens if you want a tighter or roomier tree:

```css
:root {
  --sidebar-row-padding-x: 8px;
  --sidebar-row-padding-y: 4px;
  --sidebar-row-gap: 4px;
}
```
