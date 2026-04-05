/**
 * Pure functions for building TocTreeNode[] from mdast headings.
 * Server-safe — no 'use client', no hooks, no browser APIs.
 * Used by the build pipeline (sync.ts) and server component (app-factory.tsx).
 */

import type { Root, Heading, PhrasingContent } from 'mdast'

/* ── TOC tree types ──────────────────────────────────────────────────── */

export type TocNodeType = 'page' | `h${1 | 2 | 3 | 4 | 5 | 6}`

/** Recursive tree node — the source-of-truth structure before flattening.
 *  Heading depth is encoded in the type field (h2, h3, h4...) so skipped
 *  markdown levels render at the correct visual depth. */
export type TocTreeNode = {
  label: string
  href: string
  type: TocNodeType
  children: TocTreeNode[]
}

/* ── Helper functions ────────────────────────────────────────────────── */

/** Slugify heading text for anchor IDs */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

/** Extract plain text from mdast phrasing content */
export function extractText(children: PhrasingContent[]): string {
  return children
    .map((child) => {
      if (child.type === 'text') {
        return child.value
      }
      if ('children' in child) {
        return extractText(child.children as PhrasingContent[])
      }
      return ''
    })
    .join('')
}

/** Build a nested TocTreeNode[] from mdast headings. Headings at lower
 *  depth become children of headings at higher depth, forming a tree
 *  that matches the document outline (## → ### → ####). The heading
 *  level is encoded in the type field (h2, h3, h4) so skipped levels
 *  render at the correct visual depth. */
export function generateTocTree(mdast: Root): TocTreeNode[] {
  const headings = mdast.children
    .filter((node): node is Heading => {
      return node.type === 'heading'
    })
    .map((heading) => {
      const text = extractText(heading.children)
      const id = slugify(text)
      return { label: text, href: `#${id}`, depth: heading.depth }
    })

  const result: TocTreeNode[] = []
  const stack: { node: TocTreeNode; depth: number }[] = []

  for (const h of headings) {
    const node: TocTreeNode = {
      label: h.label,
      href: h.href,
      type: `h${h.depth}` as TocNodeType,
      children: [],
    }

    /* Pop stack until we find a parent with lower depth */
    while (stack.length > 0 && (stack.at(-1)?.depth ?? 0) >= h.depth) {
      stack.pop()
    }

    const parent = stack.at(-1)
    if (!parent) {
      result.push(node)
    } else {
      parent.node.children.push(node)
    }

    stack.push({ node, depth: h.depth })
  }

  return result
}
