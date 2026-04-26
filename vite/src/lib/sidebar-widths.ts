/**
 * Grid geometry tokens + sidebar-width helpers.
 *
 * This file is the SINGLE source of truth for the page grid geometry.
 * `styles/globals.css` intentionally does NOT declare defaults for the
 * `--grid-*` custom properties — `editorial-page.tsx` injects them via
 * inline style on `.slot-page` by calling `buildGridTokenStyle()`.
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
 * Grid geometry tokens (px). Keys match the CSS custom-property names
 * that get injected as inline style on `.slot-page`. Keeping this as an
 * object (rather than individual constants) keeps the CSS var → JS
 * value mapping obvious and prevents the "constants drifted from
 * globals.css" problem: there is no globals.css copy to drift from.
 */
export const GRID_TOKENS: {
  '--grid-toc-width': number
  '--grid-content-width': number
  '--grid-gap': number
  '--grid-max-width': number
} = {
  '--grid-toc-width': 230,
  '--grid-content-width': 540,
  '--grid-gap': 50,
  '--grid-max-width': 1100,
}

/** Default right-sidebar width (px). Matches `--grid-toc-width`. */
export const DEFAULT_SIDEBAR_WIDTH = GRID_TOKENS['--grid-toc-width']

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
    const name = (node as any).name
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
 * Always emits EVERY `--grid-*` token so `globals.css` does not need to
 * declare defaults for them. Takes the page's computed right-sidebar
 * width and bumps `--grid-max-width` so the grid actually has room to
 * accommodate a widened sidebar:
 *
 *   max-width = max(baseMax, toc + content + sidebar + 2*gap)
 *
 * The `min(calc(100vw - 60px), Xpx)` wrapper preserves the original CSS
 * behaviour that capped the grid to the viewport minus safe padding.
 */
export function buildGridTokenStyle(
  sidebarWidth: number,
): HolocronCSSProperties {
  const toc = GRID_TOKENS['--grid-toc-width']
  const content = GRID_TOKENS['--grid-content-width']
  const gap = GRID_TOKENS['--grid-gap']
  const baseMax = GRID_TOKENS['--grid-max-width']

  const requiredGrid = toc + content + sidebarWidth + 2 * gap
  const maxPx = Math.max(baseMax, requiredGrid)

  return {
    '--grid-toc-width': `${toc}px`,
    '--grid-content-width': `minmax(0, ${content}px)`,
    '--grid-gap': `${gap}px`,
    '--grid-sidebar-width': `${sidebarWidth}px`,
    '--grid-max-width': `min(calc(100vw - 60px), ${maxPx}px)`,
  }
}
