---
'@holocron.so/vite': patch
---

Fix `VideoBackgroundShader` rendering in Safari by premultiplying shader color output before WebGL canvas compositing.

Low-opacity dots and ASCII glyphs now fade correctly instead of staying visually bright in dark areas of the video background. The mouse fluid effect keeps the same luminance behavior as before the Safari fix.
