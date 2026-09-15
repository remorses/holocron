---
'@holocron.so/vite': patch
---

Inject the page title as an H1 even when the body starts with a markdown heading, and emit default `og:type` and `og:url` tags on every page.

Docs pages that opened with `##` previously shipped with **no H1**. The generated title is now the only H1 unless the page uses `<Above>` or `hideTitle`. Open Graph now always includes `og:type` (`website` on `/`, `article` elsewhere) and `og:url` (the canonical absolute page URL). Frontmatter still overrides both.

Production builds already fail on broken MDX links. Footer, navbar, and anchor hrefs in `docs.json` are now validated the same way, so a footer link to a missing page fails the build instead of going live as a 404.
