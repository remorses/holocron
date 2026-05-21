/**
 * Shared URL helpers for internal link processing.
 * Used by both mdx-processor.ts (link collection) and normalize-mdx.ts
 * (link rewriting) without creating a circular dependency.
 */

/** Check if a URL uses an external or special protocol (case-insensitive). */
export function isExternalUrl(url: string): boolean {
  return /^(?:https?:|mailto:|tel:|javascript:)/i.test(url)
}

/**
 * Strip .md/.mdx extension from the path portion of a URL only.
 * Does not touch extensions inside query strings or hash fragments.
 * e.g. "/guide.md#install" → "/guide#install"
 *      "/search?file=guide.md" → "/search?file=guide.md" (unchanged)
 */
export function stripMdExtFromPath(url: string): string {
  const match = url.match(/^([^?#]*)([?#].*)?$/)
  if (!match) return url
  const pathPart = match[1] ?? ''
  const suffix = match[2] ?? ''
  return pathPart.replace(/\.mdx?$/i, '') + suffix
}
