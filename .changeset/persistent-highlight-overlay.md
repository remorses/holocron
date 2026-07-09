---
'@holocron.so/vite': minor
---

Make the `browser_highlight` chat tool a persistent onboarding-style overlay. The page dim is now much lighter (15% instead of 55% black), the optional `message` renders as a description card next to the element, and the overlay no longer auto-dismisses after a few seconds. Instead it stays visible — even after the chat turn ends — until the user clicks the × button, clicks the highlighted element itself, or the element leaves the DOM (e.g. navigation). The spotlight now tracks the element through scrolling and layout shifts.

The tool also returns immediately instead of blocking the AI loop for the overlay duration, so the model can keep responding while the highlight stays up.

The brief highlight flashed before `browser_type` actions is now a quick glow ring with no page dim, lasting only a fraction of a second.
