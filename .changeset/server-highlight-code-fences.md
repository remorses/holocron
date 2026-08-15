---
'@holocron.so/vite': patch
---

Highlight fenced code on the server so token colors are in the first HTML response and stay after in-site navigation.

MDX fences no longer wait on a client `useEffect` + Prism load. Unknown languages still render as plain text. The `@holocron.so/vite/prism` export is removed.
