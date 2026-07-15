---
'@holocron.so/vite': minor
---

Add CSS variables for customizing code blocks, blockquotes, and sidebar navigation without targeting internal selectors.

**Code blocks:**

```css
:root {
  --code-block-background: var(--muted);
  --code-block-border: 1px solid var(--border-subtle);
  --code-block-radius: var(--radius-md);
  --code-block-padding-x: 8px;
  --code-block-padding-y: 12px;
}
```

The copy button automatically aligns to the top-right of the padded frame.

**Blockquotes:**

```css
:root {
  --blockquote-border-width: 2px;
  --blockquote-border-color: var(--border-subtle);
}
```

**Sidebar navigation:**

```css
:root {
  --sidebar-group-margin-top: 16px;
  --sidebar-link-radius: var(--radius-sm);
  --sidebar-indent: 8px;
}
```
