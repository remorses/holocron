---
'@holocron.so/vite': patch
---

Fix `VideoBackgroundShader` crashing the entire site on devices where WebGL is unavailable or the context is lost (older iOS Safari under memory pressure or low power mode reported "param to webglshader must be of type shader").

- `createShader`/`createProgram` null returns now throw controlled errors instead of passing `null` into WebGL calls
- WebGL init failures are caught in the component: the page renders normally without the shader background instead of unmounting the whole React tree
- The framebuffer texture type is probed for actual renderability (half-float → float → unsigned byte fallback) instead of assuming float rendering support
- The render loop stops cleanly on `webglcontextlost` or per-frame WebGL errors
