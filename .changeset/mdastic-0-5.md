---
'@holocron.so/vite': patch
---

**Single-line components are written back on one line.** Served MDX now keeps `<Heading level={2}>Title</Heading>` and `` <Note>Use `x` here.</Note> `` as authored instead of spreading them over three lines. Rendering is unchanged.

**HTML comments are parsed by mdastic.** `<!-- -->` comments in pages are still removed from the served MDX. An unclosed `<!--` at the start of a block still hides the rest of its block quote, list item or page, like a browser.
