---
'@holocron.so/vite': patch
---

Fix `VideoBackgroundShader` crashing with "Unknown uniform: texelSize" on some GPUs.

The splat program was being assigned the `texelSize` uniform even though its fragment shader (`SPLAT_FRAG`) only reads `vUv`. On drivers that strip inactive uniforms during linking, `texelSize` is culled from the splat program and the cached-uniform lookup throws. The splat program is now excluded from the `texelSize` setup loop, since it never uses it.
