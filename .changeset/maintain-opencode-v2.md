---
'@holocron.so/cli': minor
---

`holocron maintain` now runs on OpenCode V2 (`@opencode/cli` 2.1). It no longer crashes on machines whose global `~/.config/opencode/opencode.json` uses the V2 config format. BYOK models (`--model provider/model`) read providers and credentials from your OpenCode V2 setup (`opencode auth`, `/connect`, or provider env vars). Tasks now run as V2 subagents, and the run ends only after every task is idle. Permission prompts and questions are denied, so a run never waits for input.
