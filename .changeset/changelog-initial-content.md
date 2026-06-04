---
'@holocron.so/vite': minor
---

Add `initialContent` field for changelog tabs to prepend custom MDX content above auto-generated release entries.

Point it at an MDX file whose body is spliced into the top of the changelog page, before the `<Update>` entries. Useful for adding an `<Above>` hero section, an introduction, or any custom component.

```json
{
  "tab": "Changelog",
  "changelog": "https://github.com/owner/repo",
  "initialContent": "changelog/intro"
}
```

The referenced file goes through the same URL rewriting pipeline as inline `.md` imports (`buildSplicedNodes`), so relative image paths and links resolve correctly from the intro file's directory.
