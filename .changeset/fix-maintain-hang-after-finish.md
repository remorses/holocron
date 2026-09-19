---
'@holocron.so/cli': patch
---

Fix `holocron maintain` hanging after the pages were updated until the CI job timed out. The OpenCode server was started through pnpm's `node_modules/.bin/opencode` shell shim, so stopping it only killed the shim and left the real `opencode` process running, which kept the CLI alive. The CLI now spawns the pinned `opencode` binary directly and waits for it to exit.

`holocron maintain` now fails with a clear error when the OpenCode turn ends with a provider error (auth, rate limit, context overflow, API error). Before, those runs printed "Documentation is already current." and exited 0. A run that exceeds the 25 minute limit now reports the timeout instead of a generic failure.

In GitHub Actions, OpenCode may now only push the `holocron/maintain-*` branch it creates. Pushes to any other branch are denied, and `gh` is limited to `gh pr create`, `gh pr view`, `gh pr list`, and `gh auth status`.
