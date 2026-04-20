---
title: Holocron
description: Mintlify drop-in open source replacement as a Vite plugin. Use it to create documentation websites.
---

## icons

if you add an icon to a page group don't use the same icon to the first page. this will look like there are 2 duplicate icons in the navigation tree.

if you use icons in cards components use it for all items, not only some. otherwise it will look bad.

## MDX authoring: multi-line container components

Always use multi-line form for container components (Callout, Note, Warning, Info, Tip, Check, Danger, Aside, Accordion, Steps, Card, Expandable, Panel, Frame, Prompt, etc.). Put content on its own line with a newline after the opening tag:

```mdx
<!-- ✅ CORRECT -->
<Note>
Use `Note` for neutral supporting information.
</Note>

<!-- ❌ WRONG — text won't get paragraph wrapping -->
<Note>Use `Note` for neutral supporting information.</Note>
```

Single-line form produces bare phrasing children without `<P>` wrapper or `editorial-prose` styling. Multi-line form gets proper paragraph wrapping from the MDX parser.
