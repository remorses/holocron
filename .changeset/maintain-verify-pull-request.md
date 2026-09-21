---
'@holocron.so/cli': patch
---

In GitHub Actions, `holocron maintain` now verifies the publish step after OpenCode finishes. If pages were updated but not committed, the branch was not pushed, or no pull request was opened, the job fails with a clear message instead of passing silently. On success it prints the pull request URL.

Pull request events now open the docs pull request into the PR head branch instead of always `main`, and schedule or manual runs target the repository default branch instead of a hard-coded `main`.
