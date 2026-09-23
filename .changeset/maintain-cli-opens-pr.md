---
'@holocron.so/cli': patch
---

Fix `holocron maintain` in GitHub Actions ending with `OpenCode updated pages but left them uncommitted`, or passing with no pull request when the model stopped early.

The publish flow is now split between the CLI and the model:

1. The CLI creates `holocron/maintain-<timestamp>` before OpenCode starts.
2. OpenCode edits and commits the changed pages, then must run exactly one hidden command. `holocron maintain-open-pr` records the PR title (with the body on stdin). `holocron maintain-no-changes` records that nothing needed updating. Each command checks the branch state and tells the model what to fix.
3. After the session, the CLI pushes the branch and opens the pull request through the typed Octokit REST client. If the model ran neither command, the job fails and prints the model's last message.

OpenCode no longer gets `git push` or `gh` permissions.
