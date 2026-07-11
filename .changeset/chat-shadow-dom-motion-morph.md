---
'@holocron.so/vite': patch
---

Restore Shadow DOM isolation for the standalone `ChatWidget` and morph the pill into the drawer with **Motion `layoutId`** instead of CSS view transitions.

Chrome ignores `view-transition-name` inside shadow roots, so the previous light-DOM host existed only to enable the pill → drawer morph. Motion measures layout in JS and works inside the shadow tree, so the widget can keep style isolation again (host page CSS cannot paint chat message text).

```tsx
import { ChatWidget } from '@holocron.so/vite/chat'

// Unchanged public API — pill + drawer now live under a shadow root
<ChatWidget domain="docs.myapp.com" navigate={navigate} />
```

Docs-mode sidebar assistant uses the same Motion layout id so the morph stays consistent outside the widget.
