---
'@holocron.so/vite': patch
---

Register Prism grammars on first highlight instead of at module load.

Hosting a Holocron site inside a Cloudflare Worker no longer pays `refractor.register` for every language on isolate boot. Routes that never highlight code, such as health checks, skip that cost.
