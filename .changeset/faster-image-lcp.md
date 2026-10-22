---
'@holocron.so/vite': patch
---

Make pages with images load faster. Images now show as soon as their bytes arrive instead of staying transparent until JavaScript hydrates, so the largest image no longer waits for hydration (this was the LCP element on most docs pages). Every image after the first one on a page now gets `loading="lazy"`, so below-the-fold screenshots no longer get `<link rel="preload">` tags that compete with fonts and scripts. Set `loading="eager"` on an `<Image>` to opt out.
