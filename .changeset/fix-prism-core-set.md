---
'@holocron.so/vite': patch
---

Keep HTML, HTTP, CSS, and JS highlight extras when grammars register on first use.

The first highlighted fence now installs a small core set in Prism order: markup, CSS plus extras, JavaScript plus extras, then JSON. Later fences still register only the language they need. HTML `<style>` / `<script>`, HTTP JSON bodies, and CSS/JS extra tokens stay colored.
