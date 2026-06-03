---
'@holocron.so/vite': patch
---

Add build summary tips for broken links and MDX errors.

After all individual warnings are logged, the build now prints a final summary at the end:

```
▲ holocron found 3 invalid internal links across 2 pages. Fix them or add paths to knownPaths in docs.json. See https://holocron.so/docs/create/broken-links
▲ holocron 2 pages with MDX errors. Fix the syntax issues in the pages listed above.
```

This makes it easy to spot the total count of issues without scrolling through individual warnings. The broken links summary includes a link to the docs page explaining `knownPaths`.
