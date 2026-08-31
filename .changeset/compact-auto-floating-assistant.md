---
'@holocron.so/vite': patch
'website': patch
---

Compact layout in `docs.json` now defaults the Ask AI trigger to the **floating** bottom pill.

You do not need to set `assistant.display` yourself. Set `"display": "sidebar"` if you want to keep the sidebar widget hidden without a pill.

The floating pill no longer leaves its background behind after the chat panel opens.
