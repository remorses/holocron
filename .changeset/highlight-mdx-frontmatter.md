---
'@holocron.so/vite': patch
---

Highlight YAML frontmatter in `md` / `mdx` code fences, and highlight MDX JSX tags plus `import` / `export` lines.

Prism already supports YAML frontmatter in Markdown, but only when the YAML grammar is registered first. MDX snippets now use a small grammar on top of Markdown: JSX tags (including `{expr}` attributes) and ESM import/export statements.
