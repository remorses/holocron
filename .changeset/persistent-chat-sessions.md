---
'@holocron.so/vite': minor
---

AI chat conversations now persist across page refreshes.

Every conversation gets a session id (a 256-bit random bearer token) minted by the docs site on the first message. The full conversation history is stored server-side and restored automatically:

- **Embedded docs site**: the session id lives in a first-party httpOnly cookie. After a refresh, focusing the "Ask AI" sidebar input (or opening the chat drawer) restores the previous conversation, server-rendered with the exact same markdown pipeline as live streaming.
- **Standalone `ChatWidget`** (cross-origin embeds): the session id is kept in localStorage keyed by the docs domain and sent via the `x-holocron-chat-session` header.

Sending a message right after a refresh waits for the restore first, so the new turn is appended to the previous history instead of replacing it.

The "New chat" button now also deletes the stored conversation and rotates the session id. Conversations expire automatically after 30 days of inactivity.

New proxy endpoints on the docs site: `GET /holocron-api/chat/session` (restore) and `POST /holocron-api/chat/session/clear` (delete).
