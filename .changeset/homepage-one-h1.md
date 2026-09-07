---
'@holocron.so/vite': patch
---

Keep one H1 on landing pages.

Pages with `<Above>` no longer get an extra injected title heading. Extra H1s after the first are demoted to H2, so a hero heading stays the main title and body sections stay H2.

Holocron also warns when frontmatter YAML looks nested because of an unquoted `:`, or when a parsed key contains a space and `:`. Quote those strings.
