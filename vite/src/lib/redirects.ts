/**
 * Config-driven URL redirects — registered as `.get()` routes.
 *
 * Supported source patterns (Mintlify compatible):
 *
 *   - Exact match:       "/old"              → "/new"
 *   - Named parameters:  "/users/:id"        → "/u/:id"
 *   - Trailing wildcard: "/blog/*"           → "/posts/:splat"
 *   - Combined:          "/docs/:section/*"  → "/d/:section/:splat"
 *
 * Spiceflow's trie router handles specificity natively: exact routes
 * beat :param routes beat * wildcards, regardless of registration order.
 */
import type { HolocronConfig } from '../config.ts'

type ConfigRedirect = HolocronConfig['redirects'][number]

/** Substitute `:name` and `:splat` placeholders in a destination template. */
export function interpolateDestination(template: string, params: Record<string, string>): string {
  return template.replace(/:(\w+)/g, (_, name: string) => {
    return params[name] ?? ''
  })
}

/** Deduplicate redirect rules — first declaration wins for the same source. */
export function deduplicateRedirects(rules: ConfigRedirect[]): ConfigRedirect[] {
  const seen = new Set<string>()
  return rules.filter((rule) => {
    if (seen.has(rule.source)) return false
    seen.add(rule.source)
    return true
  })
}

/**
 * Does a redirect `source` pattern match a concrete pathname? Mirrors the
 * source-pattern semantics registered as Spiceflow routes:
 *
 *   - Exact:             "/old"              matches "/old"
 *   - Named parameter:   "/users/:id"        matches "/users/42"
 *   - Trailing wildcard: "/blog/*"           matches "/blog" and "/blog/a/b"
 *
 * Used to avoid generating compatibility aliases (e.g. `/guide/index`) that
 * would shadow a user-authored redirect with the same path.
 */
export function redirectSourceMatches(source: string, pathname: string): boolean {
  // Strip hash/query from the source pattern, normalize trailing slashes.
  const cleanSource = source.replace(/[?#].*$/, '')
  const segments = cleanSource.split('/').filter(Boolean)
  const target = pathname.split('/').filter(Boolean)

  let i = 0
  for (; i < segments.length; i++) {
    const seg = segments[i]!
    if (seg === '*') {
      // Trailing wildcard matches the rest (including zero remaining segments).
      return i === segments.length - 1
    }
    if (i >= target.length) return false
    if (seg.startsWith(':')) continue // named param matches any single segment
    if (seg !== target[i]) return false
  }
  // All source segments consumed: match only if the pathname had no extras.
  return i === target.length
}
