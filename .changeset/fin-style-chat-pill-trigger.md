---
'@holocron.so/vite': patch
---

Replace the standalone ChatWidget's floating bubble trigger with a fin.ai-style textarea pill. The pill sits bottom-right on desktop (bottom-center on mobile), expands on focus with a width transition, and morphs into the chat drawer via a view transition when a message is sent — the same morph the docs sidebar assistant uses. The chat drawer panel now uses a frosted glass background (translucent token-derived color + `backdrop-filter: blur(50px)`) instead of an opaque surface with a dim overlay, in both docs and widget mode. The `trigger` prop still works for custom triggers.

The widget now renders in the page's light DOM inside a `.holocron-chat` container with build-time-scoped CSS instead of a shadow root — Chrome ignores `view-transition-name` on elements inside shadow trees, so the pill → drawer morph requires light DOM. Preflight, utilities, and component styles are all prefixed with `.holocron-chat` at build time so nothing leaks into the host page, and `:where()` keeps theme tokens at zero specificity so host overrides still win.

The send button in the docs sidebar assistant and drawer footer is now a circular arrow button matching the pill. Also fixed a `getServerSnapshot should be cached` React warning in `useChatWidget()`.
