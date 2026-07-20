---
'@holocron.so/vite': minor
---

Redesign the AI chat empty screen: sparkle illustration, a short pitch of what the assistant can do, and suggestion links styled in the primary color. Suggestions are customizable via `assistant.suggestions` in docs.json (and the `suggestions` prop on the standalone `ChatWidget`); when omitted, three defaults based on the site name are shown. A suggestion ending with `...` fills the chat input instead of submitting so the user can complete the query. The drawer input frame and send button now use the primary color instead of gray, and chat component styles (drawer shadow, dropdown animation) are now correctly loaded in the embedded holocron path, not only in the standalone shadow-DOM widget.
