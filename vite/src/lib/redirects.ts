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
