---
'@holocron.so/vite': patch
---

**Single-line components on pages with images render as one paragraph again.** On pages with local or remote images, a line like `<Note>Use `Note` for info.</Note>` was split into three paragraphs, so inline code and links inside it rendered on separate lines. Pages without images were not affected.
