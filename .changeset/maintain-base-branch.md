---
'@holocron.so/cli': minor
---

New `holocron maintain --base <branch>` option for GitHub Actions. It sets the branch the pull request targets. Without it, Maintain uses the pushed branch on `push` events and the repository default branch on schedules, manual runs, and releases.

```yaml
- run: npx -y "@holocron.so/cli" maintain --base docs
  env:
    GITHUB_TOKEN: ${{ github.token }}
```

Maintain now also checks that the checked-out commit is already on `origin/<base>` before it starts OpenCode. Before, a checkout that was not on the base branch (for example the merge commit of a `pull_request` event) opened a pull request that carried unrelated commits. Now the run fails with a clear message.
