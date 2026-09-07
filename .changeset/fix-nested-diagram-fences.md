---
'@holocron.so/cli': patch
'website': patch
---

Fix `holocron diagrams fix` so a wrapping ````mdx` fence no longer swallows later prose.

CommonMark closing fences must match the opening fence length. A nested ` ```diagram ` inside ````mdx` was treated as the closer, so the rest of the file was scanned as one diagram and long prose lines failed the 94-column check.

ASCII diagrams in the public docs now use the `diagram` language hint, including the [subpath hosting](https://holocron.so/docs/deploy/base-path) page.
