---
'@holocron.so/vite': patch
---

Allow a URL or root-absolute path in page frontmatter `icon`.

Runtime provider pages can now set `icon: https://cdn.example.com/rocket.svg` (or `/icons/rocket.svg`) and the sidebar renders it as an image. Library names, prefixed names, and emoji still work. This lets request-time pages show icons without adding them to the build-time icon atlas.

```mdx
---
title: Hello World
icon: https://cdn.example.com/rocket.svg
---
```
