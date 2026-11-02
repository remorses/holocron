---
'@holocron.so/vite': patch
---

**Image processing on rebuilds and dev saves is faster.** Remote images are downloaded once and their size and placeholder are kept in `dist/holocron-images.json`, so a sync no longer waits on the network for images it already knows. Local images that did not change (same size and modification time) are not read again.
