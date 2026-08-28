---
'@holocron.so/vite': patch
---

Report all invalid MDX pages through a typed `HolocronDataGenerationError` instead of stopping at the first parser failure.

Multi-tenant deploy pipelines can import the narrow data API and inspect every page failure without parsing error messages:

```ts
import {
  generateHolocronData,
  isHolocronDataGenerationError,
} from '@holocron.so/vite/data'

try {
  await generateHolocronData({ config, slugs, getMdxSource })
} catch (error) {
  if (!isHolocronDataGenerationError(error)) throw error

  for (const { slug, error: parseError } of error.pageErrors) {
    console.error(slug, parseError.line, parseError.reason)
  }
}
```

Each page is now parsed once and each parse error includes a stable code, source location, reason, code frame, and raw MDX source.
