---
'@holocron.so/cli': patch
---

`holocron maintain` in GitHub Actions now opens the pull request into the **checked-out branch**. Before, it read the branch from the event payload, so `workflow_dispatch` on another branch or `actions/checkout` with `ref: docs` still opened the pull request into the default branch. A detached HEAD uses the release target branch on `release` events, else the repository default branch.

```yaml
- uses: actions/checkout@v4
  with:
    ref: docs          # the maintain pull request now targets docs
    fetch-depth: 0
```

Maintain also checks that the checked-out commit is already on `origin/<base>` before it starts OpenCode. Before, a checkout that was on no branch (for example the merge commit of a `pull_request` event) opened a pull request that carried unrelated commits. Now the run fails with a clear message.
