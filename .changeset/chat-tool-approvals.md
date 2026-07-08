---
'@holocron.so/vite': patch
---

Add user approval prompts for AI chat client tools. Tools defined with `defineTool` accept a `needsApproval` field (boolean or per-call function, mirroring the AI SDK naming) — when set, the chat widget shows an Approve/Deny card before executing the tool. Denials are sent back to the model as tool errors.

The `pageTools` browser automation tools (`browser_click`, `browser_type`, `browser_select`) automatically require approval when the target element is inside a container with the `data-holocron-requires-approval` attribute. The attribute value becomes the confirmation message shown to the user:

```html
<div data-holocron-requires-approval="This will delete your account">
  <button data-action="delete-account">Delete account</button>
</div>
```

Browser tools also gained a required `description` input field so approval prompts show a human readable action summary (e.g. "Click the Delete account button") instead of raw tool arguments, and `browser_read_page` marks protected elements with "(requires user approval)".
