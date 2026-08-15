---
'@holocron.so/vite': patch
---

Highlight fenced code on the server so token colors are in the first HTML response and stay after in-site navigation.

The highlighter loads refractor's common set plus the extra languages Holocron already shipped, not all 297 grammars. That keeps the RSC worker much smaller.

MDX fences no longer wait on a client `useEffect` + Prism load. Unknown languages still render as plain text. The `@holocron.so/vite/prism` export is removed.

The code theme now covers every official Prism standard token (https://prismjs.com/tokens) plus the language-specific aliases used in Holocron docs. YAML keys, Dockerfile instructions, CSS selectors, bash variables, JS property access, and diff insert/delete no longer inherit the default text color.
