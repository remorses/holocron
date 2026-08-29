---
'@holocron.so/cli': patch
'website': patch
---

Expand `holocron maintain` source matching into git submodules.

A prompt like `@/template/src/index.mdx` now selects the page when that inner file changes. Maintain no longer treats the submodule as a single gitlink path.
