---
'@holocron.so/vite': patch
---

Count **folder-index pages** (`group.root`) as members of their version.

A page like `/de/features` that only appears as a group's `root` used to belong to no version. The sidebar then mixed every language and showed English **Home** on German pages.

Version matching, tab matching, and sidebar expand now include `group.root` hrefs. Nested docs in `navigation.versions` stay on the right language.
