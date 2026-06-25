---
'@holocron.so/vite': minor
---

Production builds now fail when content errors are detected. MDX parse errors, unknown component names, broken internal links, and broken asset references all cause the build to fail after every error has been logged.

All errors are collected and displayed first, so you see every issue at once instead of fixing them one by one.

Set `HOLOCRON_SKIP_BUILD_ERRORS=true` to bypass and deploy anyway. Pages with errors are excluded from the build output.
