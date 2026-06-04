---
'@holocron.so/vite': patch
---

Improve `VideoBackgroundShader` resource cleanup and ASCII rendering behavior.

The shader now only builds the character atlas when `dotStyle="ascii"`, releases the temporary Canvas backing store after uploading the atlas to WebGL, and guards async mask image loading after component cleanup. The video background also keeps fluid luminance visible more consistently in dark areas.
