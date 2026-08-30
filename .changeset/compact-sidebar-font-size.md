---
'@holocron.so/vite': patch
'website': patch
---

Compact mode now uses **12px** as the default `--sidebar-font-size`.

Default pages stay at 13px (14px at `xl`). Compact pages keep 12px at every breakpoint so the left nav is denser in the narrower frame. Override the token on `:root` to change the size globally.
