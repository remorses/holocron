---
'@holocron.so/vite': patch
---

Normalize nested sidebar folders so they match page rows.

Collapsible nested groups used to render at `--type-nav-group-size` (12px) with a
tighter gap under the label, which made folders read as a smaller, separate tier
from the pages around them. A nested group row is now visually a page row: same
inherited font size, same medium weight, same `gap-1.5` leading slot (the chevron
sits where a page's icon sits), and the same vertical rhythm between every row.

`--sidebar-indent` now defaults to `18px` instead of `12px` so one nesting step
equals the width of that leading slot. Nested pages line up exactly under their
group's label while the chevron stays in the gutter, giving the sidebar a proper
file-tree alignment with or without page icons. Override the token to get a
tighter tree.

Sidebar row highlights are no longer clipped. Hover, active and focus states used
to be painted *outside* the row with a `box-shadow` spread, but the sidebar
`<nav>` is `overflow-y-auto`, which per spec also clips horizontally, so the
left rounded corners were sliced flat against the clip edge. Rows now carry real
horizontal padding (`--sidebar-row-padding-x`, cancelled by an equal negative
margin so the text column is unchanged) and the highlight is the row's own
background, which can never be clipped. The browser focus ring is pulled inside
with a negative `outline-offset` for the same reason.

`--sidebar-link-radius` now defaults to `6px` instead of `0px`, so hover and
active states read as a rounded pill. Set it back to `0px` for square rows.
