/**
 * Shared MDX builder for virtual tab providers (OpenAPI, changelog, etc.).
 *
 * Virtual providers generate MDX strings that flow through the same
 * enrichment/render pipeline as on-disk pages. This helper composes the
 * three common parts — a YAML frontmatter block, an optional `<Aside full>`
 * notice column, and the page body — so providers don't each reinvent the
 * fragile string-joining (and so the frontmatter escaping stays in one place).
 */

import path from 'node:path'

/** Compute the virtual directory for a virtual page slug.
 *  A virtual page at slug `changelog` lives in `pagesDir/`.
 *  A virtual page at slug `releases/notes` lives in `pagesDir/releases/`.
 *  Used by both the changelog provider (to compute import paths) and
 *  sync.ts (to resolve inline imports from that virtual directory). */
export function virtualPageDir(pagesDir: string, slug: string): string {
  return path.join(pagesDir, slug.includes('/') ? path.dirname(slug) : '')
}

/** A frontmatter value. Strings are quoted + escaped; numbers/booleans are
 *  emitted raw. `undefined` keys are skipped. */
export type FrontmatterValue = string | number | boolean | undefined

/** Serialize a single frontmatter entry. Strings are double-quoted with
 *  quotes/newlines escaped; numbers and booleans are emitted verbatim. */
function frontmatterLine(key: string, value: Exclude<FrontmatterValue, undefined>): string {
  if (typeof value === 'string') {
    const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')
    return `${key}: "${escaped}"`
  }
  return `${key}: ${value}`
}

/**
 * Build a virtual MDX page string.
 *
 * Layout:
 *   ---
 *   <frontmatter>
 *   ---
 *
 *   import ...         (only when `imports` is provided)
 *
 *   <Aside full>      (only when `aside` is provided)
 *   <aside content>
 *   </Aside>
 *
 *   <body>
 */
export function buildVirtualPageMdx({
  frontmatter,
  imports,
  aside,
  body,
}: {
  frontmatter: Record<string, FrontmatterValue>
  /** Raw import declaration lines to place after frontmatter. MDX requires
   *  imports before any non-import content. */
  imports?: string[]
  aside?: string
  body: string
}): string {
  const fmLines = Object.entries(frontmatter)
    .filter((entry): entry is [string, Exclude<FrontmatterValue, undefined>] => entry[1] !== undefined)
    .map(([key, value]) => frontmatterLine(key, value))

  const parts: string[] = ['---', ...fmLines, '---', '']

  if (imports && imports.length > 0) {
    parts.push(...imports, '')
  }

  if (aside !== undefined) {
    parts.push('<Aside full>', '', aside.trim(), '', '</Aside>', '')
  }

  parts.push(body)
  return parts.join('\n')
}
