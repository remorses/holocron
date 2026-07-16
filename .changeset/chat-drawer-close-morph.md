---
'@holocron.so/vite': patch
---

Improve the AI chat drawer close animation. The drawer now stays in the DOM while closing (via Motion `AnimatePresence`) so it visibly morphs back into the sidebar "Ask AI" widget or the chat pill with a crossfade, instead of vanishing instantly. The pill and sidebar widget stay mounted (hidden from view and the a11y tree) while the drawer is open so Motion always has the origin bounds to morph back into.
