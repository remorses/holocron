---
'@holocron.so/cli': patch
---

Fix `holocron maintain` in GitHub Actions ending with `OpenCode updated pages but left them uncommitted`, or passing with no pull request when the model stopped early.

The publish flow is now split between the CLI and the model:

1. The CLI creates `holocron/maintain-<timestamp>` before OpenCode starts.
2. When pages changed, OpenCode commits them and runs the hidden `holocron maintain-open-pr --title "..."` command with the PR body on stdin. The command checks the branch state and tells the model what to fix.
3. After the session, the CLI pushes the branch and opens the pull request through the typed Octokit REST client. If pages changed but the model never ran the command, the job fails and prints the model's last message.

OpenCode no longer gets `git push` or `gh` permissions.
