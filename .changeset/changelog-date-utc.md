---
'@holocron.so/vite': patch
---

Format changelog release dates in UTC. A release published at `2026-01-05T00:00:00Z` was labelled with the build machine's local calendar day, so the same GitHub release rendered as `Jan 5, 2026` in Europe and `Jan 4, 2026` in the US. The generated page (and its cache entry) now reads the same everywhere.
