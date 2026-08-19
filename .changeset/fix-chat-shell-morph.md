---
'@holocron.so/vite': patch
---

Fix the AI chat open/close animation. The trigger now really morphs into the drawer instead of popping, and the morph no longer runs on client-side page changes.

The shared layout animation never ran: both the trigger and the drawer passed `layoutDependency`, which stops Motion from snapshotting the outgoing box, so the two `layoutId` members never paired and the panel jumped straight to full size. What looked like an animation was only the text fading over a shell that had already resized.

Each page's Ask AI widget now uses its own `layoutId`, so navigating to another page cannot pair the old widget with the new one. The open and close morph still shares the id of the page you are on.

With the morph restored, the panel is now a plain shell that owns the background, radius and elevation, and all of its content sits in a counter-scaled layer. Text and inputs render at their final size for the whole transition instead of stretching with the shell. The content fade is delayed until the shell is roughly panel-sized, and the trigger stays mounted so opening and closing both get a real crossfade. Opening runs at 440ms, closing at 340ms.
