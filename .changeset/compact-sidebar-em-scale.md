---
'@holocron.so/vite': patch
---

Scale the left sidebar down on smaller screens.

Sidebar type, icons, padding, and row spacing now use `em` relative to `--sidebar-font-size`. Below the `xl` breakpoint the left sidebar is **13px** instead of **14px**, so the whole nav densifies together. The mobile drawer and large desktops stay at 14px.

Override `--sidebar-font-size` in your CSS to change the size at any breakpoint. Spacing follows automatically.
