---
'@holocron.so/vite': minor
---

Auto-generate `<meta name="description">` from page body text when no frontmatter `description` is set.

Pages without an explicit `description` in YAML frontmatter now get a meta description extracted from the first paragraphs of the MDX content. The text is truncated at ~160 characters on a word boundary. Headings, code blocks, and JSX elements are skipped; only paragraph prose is used.

Frontmatter `description` always takes precedence. If no paragraph text is found (e.g. JSX-only pages), the field stays `undefined` and falls through to the site-level `description` from `docs.json`.

No extra MDX parsing is needed; the function reuses the mdast tree already produced during the build.
