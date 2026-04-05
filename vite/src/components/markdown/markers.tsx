'use client'

/**
 * MDX marker components — parsed at build time, consumed by the section
 * splitter in lib/mdx-sections.ts. They render as pass-throughs at runtime.
 */

import React from 'react'

/** Aside is a marker component for MDX. On desktop, its children are extracted
 *  by the section grouping logic and rendered in the right sidebar slot.
 *  On mobile, it stacks inline after its section's content.
 *  The component itself is a pass-through.
 *
 *  Use `<Aside full>` to make the aside span every heading-introduced
 *  sub-section after it (until the next `<Aside>` of any kind, or end of
 *  page). Splits happen at every heading level (#, ##, ###, ...) so the
 *  sub-sections still get `--section-gap` between them; the aside sits in
 *  a grid cell with `grid-row: start / span N` so `position: sticky` keeps
 *  it pinned alongside the full range. */
export function Aside({ children, full }: { children: React.ReactNode; full?: boolean }) {
  void full // marker prop — used at parse time, not at render time
  return <>{children}</>
}

/** FullWidth is a marker component for MDX. Its children become a section that
 *  spans both the content and aside columns in the grid layout. */
export function FullWidth({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

/** Hero — page-level hero content (logo, heading, etc.). Extracted at parse
 *  time (like <Aside>) and rendered above the 3-column grid, aligned with
 *  the center content column. Accepts arbitrary props from MDX. */
export function Hero({ children, ...props }: { children: React.ReactNode } & React.ComponentPropsWithoutRef<'div'>) {
  return <div {...props}>{children}</div>
}
