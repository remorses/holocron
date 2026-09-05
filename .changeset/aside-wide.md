---
'@holocron.so/vite': minor
'website': minor
---

Add `<Aside wide>` so the right rail can take leftover viewport space, like API reference pages.

The middle content column stays capped at **720px**. Extra width goes to the aside instead of becoming gap.

```mdx
<Aside wide>
<Note>
This rail grows into leftover space on the right.
</Note>
</Aside>
```

Use `width` for a fixed pixel size, or combine it with `wide` as the minimum:

```mdx
<Aside wide width={480}>
<Panel>
  Large examples, diagrams, or embeds.
</Panel>
</Aside>
```
