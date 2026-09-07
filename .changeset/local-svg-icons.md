---
'@holocron.so/vite': patch
---

Inline local SVG file icons into the Holocron icon atlas.

Root-absolute paths like `/icons/vercel.svg` and relative paths like `./icons/vercel.svg` now render as the same sized `currentColor` SVG as Lucide icons, instead of a plain `<img>`. Holocron looks in `public/`, then the project root. A missing file fails the production build. Remote `https://` icons still render as images.
