---
'@holocron.so/vite': patch
---

Fix `VideoBackgroundShader` rendering in Safari by premultiplying shader color output before WebGL canvas compositing.

Low-opacity dots and ASCII glyphs now fade correctly instead of staying visually bright in dark areas of the video background. The mouse fluid effect now also boosts luminance within the configured `fluidStrength` instead of saturating hover areas to white.
