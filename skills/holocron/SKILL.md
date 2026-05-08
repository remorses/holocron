---
title: Holocron
description: Mintlify drop-in open source replacement as a Vite plugin. Use it to create documentation websites.
---

## icons

The default icon library is **Font Awesome** (`fontawesome`). To use Lucide icons instead, set `"icons": { "library": "lucide" }` in `docs.json`. Icon names like `home`, `zap`, `file-text`, `panel-left` are Lucide names and won't resolve with the default Font Awesome library.

If you add an icon to a page group don't use the same icon to the first page. This will look like there are 2 duplicate icons in the navigation tree.

If you use icons in cards components use it for all items, not only some. Otherwise it will look bad.

## MDX authoring: multi-line container components

Always use multi-line form for container components (Callout, Note, Warning, Info, Tip, Check, Danger, Aside, Accordion, Steps, Card, Expandable, Panel, Frame, Prompt, etc.). Put content on its own line with a newline after the opening tag. Single-line form produces bare phrasing children without paragraph wrapping.

```mdx
<Note>
Use `Note` for neutral supporting information.
</Note>
```

## Aside must always contain a component

`<Aside>` is positioning-only with no visual frame. Always wrap content in `<Note>`, `<Tip>`, `<Info>`, `<Warning>`, `<Callout>`, or another framed component. Exception: `<Aside full>` with `<TableOfContentsPanel />`.

```mdx
<Aside>

<Note>
This appears in the sidebar with a proper callout frame.
</Note>

</Aside>
```

## New MDX pages must be added to docs.json navigation

After creating a new `.mdx` file, add its slug to `docs.json` navigation. Pages not in the navigation tree won't appear in the sidebar. Read the existing structure and pick the best tab, group, and position within reading order.
