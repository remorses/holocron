---
'@holocron.so/vite': minor
---

Hide the left sidebar's inline heading list on pages that render `<TableOfContentsPanel />` — the table of contents is already visible in the right aside, so repeating it under the active page entry was redundant. Detection is automatic at build time.

A new `sidebarToc` frontmatter field overrides the behavior in either direction:

```yaml
---
title: My Page
# false: always hide sidebar headings for this page
# true: always show them, even with a TableOfContentsPanel present
sidebarToc: false
---
```

Search results still show matched headings regardless of suppression, so heading hits stay reachable.
