---
'@holocron.so/vite': patch
---

Scroll the left sidebar to the current page on load and on client navigation.

Deep links into a long nav used to leave the tree at the top, so the active
row sat off-screen. The current page now gets `aria-current="page"`. Chrome
and Edge use `scroll-initial-target` for the first paint. Other browsers and
client-side navigations call `scrollIntoView({ block: 'nearest' })` from a
stable ref. Ancestor groups of the current page still open so the row exists
in the layout before that scroll runs.
