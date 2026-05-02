/**
 * Grid geometry tokens + sidebar-width helpers.
 *
 * This file is the SINGLE source of truth for the page grid geometry.
 * `editorial-page.tsx` injects page-specific values as inline style on
 * `.slot-page` by calling `buildGridTokenStyle()`. `globals.css` owns the
 * default responsive `--grid-gap`; page frontmatter can override it inline.
 *
 * Content width is DERIVED, not configured:
 *   content = max-width - nav - sidebar - 2*gap
 *
 * This means changing `--grid-max-width` automatically grows the content
 * column, and widening the sidebar (e.g. for OpenAPI pages) automatically
 * shrinks it — the overall page width never jumps.
 *
 * It also computes the required right-sidebar width for a page by
 * scanning aside mdast nodes for known components that need extra
 * horizontal space (e.g. RequestExample / ResponseExample). At render
 * time we walk every aside node, look up the name of each JSX element
 * encountered, and take the max. Components not listed fall through to
 * the default sidebar width.
 */

import type { HolocronCSSProperties } from './css-vars.ts'

/**
 * Grid geometry tokens (px). Only the 4 independent values — content
 * width is derived from these via calc() in `buildGridTokenStyle()`.
 *
 * Keys match the CSS custom-property names that get injected as inline
 * style on `.slot-page`.
 */
export const GRID_TOKENS = {
  '--grid-nav-width': 230,
  '--grid-sidebar-width': 230,
  '--grid-gap': 60,
  '--grid-max-width': 1200,
} as const

/** Default right-sidebar width (px). Matches `--grid-nav-width`. */
export const DEFAULT_SIDEBAR_WIDTH: number = GRID_TOKENS['--grid-sidebar-width']

/** Minimum right-sidebar width (px) required when an Aside contains the
 *  given MDX component name. Components not listed fall through to the
 *  DEFAULT_SIDEBAR_WIDTH. */
export const COMPONENT_SIDEBAR_WIDTHS: Record<string, number> = {
  RequestExample: 396,
  ResponseExample: 396,
}

/**
 * Walk an array of aside mdast nodes (and all descendants) and return the
 * max sidebar width needed. Used by `app-factory.tsx` after `buildSections`
 * to derive a page-level sidebar width.
 *
 * Takes `visit` as a parameter so `unist-util-visit` is NOT a module-level
 * import — this prevents it leaking into the client graph when
 * `editorial-page.tsx` imports `buildGridTokenStyle` from this file.
 */
export function computeSidebarWidthFromAsideNodes(
  nodes: import('mdast').RootContent[],
  visit: typeof import('unist-util-visit').visit,
): number {
  let maxWidth = DEFAULT_SIDEBAR_WIDTH
  const fakeRoot: import('mdast').Root = { type: 'root', children: nodes }
  visit(fakeRoot, (node) => {
    if (
      node.type !== 'mdxJsxFlowElement' &&
      node.type !== 'mdxJsxTextElement'
    ) {
      return
    }
    const name = node.name
    if (!name) return
    const width = COMPONENT_SIDEBAR_WIDTHS[name]
    if (typeof width === 'number' && width > maxWidth) {
      maxWidth = width
    }
  })
  return maxWidth
}

/**
 * Build the inline-style CSS custom properties for the page grid.
 *
 * Emits all `--grid-*` tokens so `globals.css` does not need defaults.
 * Content width is a CSS calc() derived from the other four tokens:
 *
 *   content = max-width - nav - sidebar - 2*gap
 *
 * This keeps the page max-width constant regardless of sidebar width.
 * Bump `--grid-max-width` and the content column grows automatically.
 */
export function buildGridTokenStyle(
  sidebarWidth: number,
  gridGap?: number,
): HolocronCSSProperties {
  const nav = GRID_TOKENS['--grid-nav-width']
  const maxW = GRID_TOKENS['--grid-max-width']

  return {
    '--grid-nav-width': `${nav}px`,
    ...(gridGap !== undefined && { '--grid-gap': `${gridGap}px` }),
    '--grid-sidebar-width': `${sidebarWidth}px`,
    '--grid-max-width': `min(calc(100vw - 60px), ${maxW}px)`,
    '--grid-content-width': `minmax(0, calc(var(--grid-max-width) - var(--grid-nav-width) - var(--grid-sidebar-width) - 2 * var(--grid-gap)))`,
  }
}
