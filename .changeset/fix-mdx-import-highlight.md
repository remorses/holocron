---
'@holocron.so/vite': patch
---

Keep highlighting through multiline MDX `import` / `export` statements.

The MDX fence grammar now treats an import as one block until the next blank line. That matches MDX, which needs a blank line before markdown. `from './foo'`, `import type`, and side-effect imports stay colored. Indented markdown after a blank line is not eaten as part of the import.
