---
'@holocron.so/cli': patch
---

Maintain commits opened by `holocron maintain` in GitHub Actions are now authored by `holocron.so <bot@holocron.so>`. The identity is set in code via `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars on the OpenCode process instead of editing the repo's git config, so it can never fall back to `github-actions[bot]`. Pull request bodies also end with the line `*PR opened by [holocron.so](https://holocron.so)*`.
