---
'@holocron.so/vite': patch
---

Fix page semantics and navigation for large migrated documentation sites.

- Render one frontmatter page-title H1 even when MDX starts with a callout, heading, or has no body content. H2-H6 keep their source depth, body H1 headings become H2, and repeated title headings are removed from the body TOC. Set `hideTitle: true` to opt out.
- Resolve percent-encoded apostrophes and parentheses through one canonical page route without overriding explicit redirects. Sitemap entries now come from the same valid page manifest as HTML and `.md` routes, with URL encoding and XML escaping.
- Keep the right page TOC opt-in through an authored `<Aside><TableOfContentsPanel /></Aside>`. Compact previous and next arrows expose page names through tooltips and accessible labels.
- Validate missing root-relative icon files and avoid eager preload hints for sidebar icon images.
- Recover loader data once per request after RSC program reloads instead of returning a transient 500 during development. Production still reports missing loader wiring as an error.
