---
'@holocron.so/vite': patch
---

Document `VideoBackgroundShader` `dotAlphaMultiplier` for washing the dots out.

This prop is 0-1 (default 1) and multiplies painted-dot alpha in the shader. CSS opacity on `canvasClassName` fades the whole canvas layer instead. Use `dotAlphaMultiplier` when the shader looks too strong.

```mdx
<VideoBackgroundShader
  src="/hero-bg.mp4"
  dotAlphaMultiplier={0.4}
/>
```
