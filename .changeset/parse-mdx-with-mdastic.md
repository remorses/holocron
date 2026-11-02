---
'@holocron.so/vite': minor
---

**MDX pages now parse and serialize with [mdastic](https://github.com/remorses/mdastic) instead of remark.** mdastic gives the same mdast and the same MDX output as remark, so pages render the same. It is much faster, and it removes remark, unified, micromark and the `mdast-util-*` packages from the dependencies. safe-mdx is updated to 2.0.0, which also parses with mdastic.

If you call `processMdx` directly, two things change:

- `normalizeMdxOptions.prependPlugins` is now `normalizeMdxOptions.prependTransforms`. It takes plain `(tree) => void` functions instead of remark plugins.
- `ProcessedMdx['mdast']` is typed with mdastic node types. Import node types from `mdastic` instead of `mdast`.

```ts
import { visit, type Root } from 'mdastic'
import { processMdx } from '@holocron.so/vite'

const result = processMdx(source, 'fontawesome', '/page', {
  normalizeMdxOptions: {
    prependTransforms: [
      (tree: Root) => visit(tree, 'text', (node) => { node.value = node.value.trim() }),
    ],
  },
})
```

Tree-only remark plugins still work through `remarkTransform(plugin)` from `mdastic/remark`.
