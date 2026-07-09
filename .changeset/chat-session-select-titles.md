---
'@holocron.so/vite': minor
---

The AI chat drawer now has a session switcher with AI-generated conversation titles.

The top bar's trash button is replaced by two controls:

- **Session select** (shadcn-style Radix select) showing the current conversation's title. Past sessions are stored locally in localStorage (per docs site) and listed as options — picking one restores that conversation from its server-side snapshot.
- **New chat button** (plus icon) that rotates to a fresh session. The old conversation is no longer deleted; it stays in the session list so you can switch back to it.

Titles are generated server-side by the gateway with a one-shot cheap model call on the first message of a session and streamed back as a `title` chunk. Until the title arrives, the select shows a truncated preview of the first user message as placeholder.

`useChatWidget().clear` now starts a fresh session instead of deleting the stored conversation.
