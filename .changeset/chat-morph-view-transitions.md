---
'@holocron.so/vite': patch
---

Replace Motion with native view transitions for the Ask AI pill and sidebar widget opening into the chat drawer. This removes `motion` from the dependencies and about 140KB of JavaScript from every docs page. The morph also works in the standalone `ChatWidget` inside its Shadow DOM. Browsers without view transitions, or with reduced motion enabled, open and close the drawer instantly.
