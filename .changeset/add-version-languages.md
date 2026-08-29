---
'@holocron.so/vite': minor
---

Add locale-aware version navigation with `navigation.versions[].lang`.

```json
{
  "navigation": {
    "versions": [
      { "version": "English", "lang": "en", "pages": ["en/index"] },
      { "version": "Nederlands", "lang": "nl", "pages": ["nl/index"] }
    ]
  }
}
```

Holocron sets the document `lang` from the exact version that owns the current page. The tab bar, sidebar, search, and previous/next navigation now use only that version's tree without claiming dropdown pages that share its path prefix.
