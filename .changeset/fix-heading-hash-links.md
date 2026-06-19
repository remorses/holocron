---
'@holocron.so/vite': patch
---

Fix heading hash links not scrolling to the correct section.

Headings with special characters like `+` produced mismatched IDs between
the DOM element and navigation/TOC links. For example, `### Install CLI + skill`
rendered with `id="install-cli-skill"` in the DOM but sidebar and TOC links
pointed to `#install-cli--skill`.

The root cause was a custom `slugify()` that collapsed consecutive hyphens
(`--` to `-`), while `github-slugger` (used for navigation data) preserves them.
Now all heading ID generation uses `github-slugger` directly.
