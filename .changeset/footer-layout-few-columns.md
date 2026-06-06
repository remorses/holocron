---
'@holocron.so/vite': patch
---

Improve footer layout for sites with few link columns.

When a footer has **≤2 link columns**, the columns now render inline with the logo on the right side of the same row instead of below it in a sparse grid. This looks much better for small footers.

When there are **≥3 columns**, the logo and socials are centered above the columns, which use `justify-between` for even spacing.

Footer group titles are now smaller (`11px`), `font-medium`, and lower opacity for a more refined look.
