---
'@holocron.so/vite': patch
---

Fix duplicate section titles sharing one HTML id.

Two headings named Accounts used to both render as `id="accounts"`. The sidebar TOC already had `accounts-1`, so scrolling the second section highlighted the first. Heading ids now use GithubSlugger suffixes, same as the TOC.
