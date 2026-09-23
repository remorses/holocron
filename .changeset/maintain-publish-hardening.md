---
'@holocron.so/cli': patch
---

Safer publish step for `holocron maintain` in GitHub Actions:

1. **OpenCode no longer sees GitHub credentials.** `GITHUB_TOKEN`, `GH_TOKEN`, `HOLOCRON_KEY`, and the GitHub OIDC request token are removed from the OpenCode environment. The CLI pushes with the token directly, so set `persist-credentials: false` on `actions/checkout`:

   ```yaml
   - uses: actions/checkout@v4
     with:
       fetch-depth: 0
       persist-credentials: false
   ```

2. **Checks run before OpenCode starts.** A missing `GITHUB_TOKEN`, a `pull_request` event, a checkout on a `holocron/maintain-*` branch, a shallow clone, or a missing `origin/<base>` ref fail right away with a clear message, before any model cost.
3. **The branch is checked again right before the push.** The CLI does not trust what the model reported earlier.
4. **No orphan branches.** If the pull request cannot be opened, the CLI deletes the branch it pushed and tells you which permission to check.
