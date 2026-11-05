---
'@holocron.so/vite': patch
---

**Cards, borders, inputs and muted surfaces now follow `--background`.** Before, they were fixed zinc grays, so a site with a tinted background (mint, cream, green-black) got gray cards and bright gray borders, worst in dark mode.

Now `--card`, `--popover`, `--secondary`, `--muted`, `--border`, `--input`, `--ring`, `--sidebar`, `--sidebar-accent` and `--sidebar-border` mix `--foreground` into `--background`. Setting only the background is enough:

```css
:root {
  --background: #f8fbf9;
  @variant dark {
    --background: #07100c;
  }
}
```

With the default background the colors are the same as before. Sites that already set these variables are unchanged.
