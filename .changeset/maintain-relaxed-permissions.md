---
'@holocron.so/cli': patch
---

`holocron maintain` gives OpenCode relaxed permissions. The model can run any shell command, read any file, and fetch any URL, so it no longer fails on denied helper commands like `ls` or `cd … && git …`. Only `git push` and `gh` stay denied, and those denies also apply to task subagents. After the run, Maintain still fails if files outside the selected pages changed.
