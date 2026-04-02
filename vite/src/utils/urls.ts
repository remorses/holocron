/**
 * Holocron URL helpers for matching page and hash links in the sidebar tree.
 */

export function normalizeUrl(urlOrPath: string): string {
  if (urlOrPath.length > 1 && urlOrPath.endsWith('/')) {
    return urlOrPath.slice(0, -1)
  }
  return urlOrPath
}

export function isActiveUrl(href: string, currentUrl: string): boolean {
  return normalizeUrl(href) === normalizeUrl(currentUrl)
}
