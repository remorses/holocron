---
'@holocron.so/cli': patch
'website': patch
---

Bill Holocron Maintain from the AI Gateway `usage` object in the stream. Missing usage charges a bounded estimate instead of $0. Unknown models return 400. Credit exhaustion returns 402. The complete route no longer accepts a client-reported cost.
