---
'@holocron.so/cli': patch
---

Print the real OpenCode error when Maintain fails, instead of `{}`.

Hosted Maintain runs now use a **25-minute** provider timeout, matching the CLI run timeout. The previous OpenCode default of 5 minutes aborted long documentation updates with an empty error object.
