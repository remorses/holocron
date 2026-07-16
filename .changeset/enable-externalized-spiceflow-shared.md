---
'@holocron.so/vite': patch
---

Re-enable Spiceflow shared dependency externalization by default now that its import-map providers are self-contained browser ESM. Holocron sites and federation payloads share the host React runtime without import-map cycles or browser `require()` failures. Set `externalizeShared: false` in the Holocron plugin options to bundle shared dependencies instead.
