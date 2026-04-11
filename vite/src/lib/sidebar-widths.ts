/**
 * Compute the required right-sidebar width for a page by scanning aside
 * mdast nodes for known components that need extra horizontal space.
 *
 * The map below lists JSX component names that imply a minimum sidebar
 * width (in pixels). At render time we walk every aside node, look up the
 * name of each JSX element encountered, and take the max. Components that
 * are not in the map fall through to DEFAULT_SIDEBAR_WIDTH.
 *
 * The resulting number is written to `--grid-sidebar-width` as an inline
 * style on `.slot-page`, and `--grid-max-width` is bumped accordingly so
 * the grid actually has room to expand.
 */

import type { Root, RootContent } from 'mdast'
import { visit } from 'unist-util-visit'

/** Minimum right-sidebar width (px) required when an Aside contains the
 *  given MDX component name. Components not listed fall through to the
 *  DEFAULT_SIDEBAR_WIDTH. */
export const COMPONENT_SIDEBAR_WIDTHS: Record<string, number> = {
  RequestExample: 440,
  ResponseExample: 440,
}

/** Default sidebar width (px). Matches `--grid-sidebar-width` /
 *  `--grid-toc-width` in `styles/globals.css`. */
export const DEFAULT_SIDEBAR_WIDTH = 210

/**
 * Walk an array of aside mdast nodes (and all descendants) and return the
 * max sidebar width needed. Used by `app-factory.tsx` after `buildSections`
 * to derive a page-level sidebar width.
 *
 * Walks every `mdxJsxFlowElement` and `mdxJsxTextElement`, reads the
 * component `name`, and picks the largest entry in
 * `COMPONENT_SIDEBAR_WIDTHS`. Falls back to `DEFAULT_SIDEBAR_WIDTH` when
 * nothing matches.
 */
export function computeSidebarWidthFromAsideNodes(
  nodes: RootContent[],
): number {
  let maxWidth = DEFAULT_SIDEBAR_WIDTH
  const fakeRoot: Root = { type: 'root', children: nodes }
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
