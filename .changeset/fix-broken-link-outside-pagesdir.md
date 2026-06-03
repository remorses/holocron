---
'@holocron.so/vite': patch
---

Fix false broken link warnings when imported markdown files outside pagesDir link back into pagesDir.

When a file like `README.md` at the repo root is imported into a page inside pagesDir and contains
relative links back to pages (e.g., `./website/src/openapi.md`), those links are now correctly
resolved to absolute slug paths (`/openapi`) instead of raw filesystem-relative paths that the link
checker couldn't match.

This fixes the "import a README that renders on GitHub too" pattern. Previously all relative links
in such imported files showed as broken, regardless of whether the filesystem path was correct.
