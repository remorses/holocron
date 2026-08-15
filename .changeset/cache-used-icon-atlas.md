---
'@holocron.so/vite': patch
---

Keep used icon SVGs in the build cache instead of shipping every Lucide and Font Awesome glyph in the worker.

The request loader used to import the full Iconify packs (~2 MB of SVG JSON) so it could look up `lucide:rocket` and similar names. The worker now reads a small atlas of the icons the site actually uses, stored in `dist/holocron-mdx.json` next to the other sync caches. Later builds and dev reloads reuse those bodies and only load Iconify when a new icon name appears.

Icons in the navbar, sidebar, and MDX still render the same way. No `docs.json` change is required.
