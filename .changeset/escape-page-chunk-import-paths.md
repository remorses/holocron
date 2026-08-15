---
'@holocron.so/vite': patch
---

Escape slugs in `generateHolocronData` `import()` paths with `JSON.stringify`.

A page slug that contains `"` used to emit invalid JS in `holocron-data.js`:

```js
import("./holocron-page-quotes-"-broken.js")
```

The object key was already stringified. The import specifier is now too, so quotes, backticks, and newlines in slugs no longer crash the worker.

```js
import("./holocron-page-quotes-\"-broken.js")
```
