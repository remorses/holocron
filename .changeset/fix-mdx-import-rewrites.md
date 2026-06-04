---
'@holocron.so/vite': patch
---

Fix inlined MDX imports that contain both an exported string constant and an import with the same relative path.

Holocron now rewrites only the actual import source when an imported `.mdx` partial is spliced into another page, so nearby exported constants keep their original value while component imports still resolve from the parent page.
