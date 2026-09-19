---
'@holocron.so/vite': minor
---

Add the `FAQ` and `FAQ.Item` MDX components. `FAQ` renders a divider-separated question list where each row expands inline. When the site assistant is enabled, a trailing ask row lets readers type their own question; the answer is generated from the docs and appended as a new row. Ask requests are ephemeral and never touch the chat drawer session.

```mdx
<FAQ askPlaceholder="Ask anything about Holocron...">
  <FAQ.Item question="What is Holocron?">
    A Vite plugin that turns MDX files and a docs.json into a docs site.
  </FAQ.Item>
</FAQ>
```
