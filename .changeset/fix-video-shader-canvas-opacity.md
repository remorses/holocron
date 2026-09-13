---
'@holocron.so/vite': patch
---

Fix `VideoBackgroundShader` so `canvasClassName` opacity classes apply after the canvas fades in.

The canvas used an inline `opacity: 1` once ready, which overrode Tailwind classes like `opacity-40` and `dark:opacity-60`. The hidden state is now a class (`opacity-0!`) that is removed when the canvas is ready, so caller opacity classes can take effect.

```mdx
<VideoBackgroundShader
  src="/hero-bg.mp4"
  canvasClassName="dark:opacity-60 opacity-40"
/>
```
