---
'@holocron.so/vite': patch
---

Fix markdown image sizing, nested links in linked components, unknown-language code block controls, and custom callout icon fallbacks.

Images now keep author `width`, `height`, and `style` values separate from intrinsic placeholder dimensions. Responsive image height follows the constrained frame width, so `object-fit: contain` does not create blank bands. Explicit image widths stay inside narrow content columns. Card, Tile, and linked Badge content can contain valid interactive links without nested anchors, and disabled cards always use non-interactive markup.
