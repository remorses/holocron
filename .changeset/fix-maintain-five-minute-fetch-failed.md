---
'@holocron.so/cli': patch
---

Fix `holocron maintain` failing with `OpenCode failed to maintain the selected pages. fetch failed` after exactly five minutes. The CLI waits on OpenCode's blocking prompt endpoint, which only responds once the whole run is done, and Node's `fetch` gives up on any response whose headers take longer than five minutes. Long runs on hosted models never survived that limit. The OpenCode client now uses an `undici` agent with the headers and body timeouts disabled, so runs can use the full 25 minute budget.
