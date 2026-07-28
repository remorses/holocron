---
'@holocron.so/vite': patch
---

Drop line numbers and the right-edge bleed from code blocks rendered inside the AI chat panel. The chat column is much narrower than a docs page, so the number gutter ate horizontal space and the bleed pushed code past the panel padding. Docs pages are unchanged.
