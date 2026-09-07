---
'@holocron.so/vite': patch
---

Keep Ask AI sticky on pages whose only asides sit in the intro.

If later headings have no asides of their own, Holocron now injects a page-spanning `<Aside full>` and collects those intro callouts into it. Ask AI no longer unsticks after the first section.

Also restore vertical padding on left-sidebar TOC heading rows. A later commit zeroed `paddingBlock` on those links, which made section items look cramped.
