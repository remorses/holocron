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

/**
 * Marker prefix for links inside inlined .md content that point to another
 * imported .md/.mdx file. The portion after the prefix is the base64url of
 * the target's absolute filesystem path. A `#hash` may be appended.
 *
 * sync.ts resolves these markers to the first-importer page href in a
 * post-pass once every page's importers are known. base64url has no
 * `.mdx?` suffix so neither relative-URL rewriting nor .md-extension
 * stripping touches the marker before it is resolved.
 */
export const IMPORTED_MD_LINK_PREFIX = 'holocron-md-import:'

/** Encode an absolute path (+ optional hash/query) into an imported-md marker. */
export function encodeImportedMdLink(absPath: string, suffix: string): string {
  const encoded = Buffer.from(absPath, 'utf-8').toString('base64url')
  return IMPORTED_MD_LINK_PREFIX + encoded + suffix
}

/**
 * Decode an imported-md marker back into { absPath, suffix }. Returns
 * undefined for any URL that is not a marker.
 */
export function decodeImportedMdLink(
  url: string,
): { absPath: string; suffix: string } | undefined {
  if (!url.startsWith(IMPORTED_MD_LINK_PREFIX)) return undefined
  const rest = url.slice(IMPORTED_MD_LINK_PREFIX.length)
  const match = rest.match(/^([^?#]*)([?#].*)?$/)
  if (!match) return undefined
  const encoded = match[1] ?? ''
  const suffix = match[2] ?? ''
  try {
    const absPath = Buffer.from(encoded, 'base64url').toString('utf-8')
    if (!absPath) return undefined
    return { absPath, suffix }
  } catch {
    return undefined
  }
}
