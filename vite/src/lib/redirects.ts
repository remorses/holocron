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

export type RedirectMatch = {
  params: Record<string, string>
}

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

export function matchRedirect(source: string, pathname: string): RedirectMatch | null {
  const sourceParts = source.split('/').filter(Boolean)
  const pathParts = pathname.split('/').filter(Boolean)
  const params: Record<string, string> = {}

  let i = 0
  for (; i < sourceParts.length; i++) {
    const part = sourceParts[i]
    if (!part) continue
    if (part === '*') {
      params.splat = pathParts.slice(i).join('/')
      return { params }
    }
    const value = pathParts[i]
    if (value == null) return null
    if (part.startsWith(':')) {
      params[part.slice(1)] = value
      continue
    }
    if (part !== value) return null
  }

  if (i !== pathParts.length) return null
  return { params }
}

export function compareRedirectSpecificity(a: ConfigRedirect, b: ConfigRedirect): number {
  const aScore = getRedirectSpecificityScore(a.source)
  const bScore = getRedirectSpecificityScore(b.source)
  for (let i = 0; i < Math.max(aScore.length, bScore.length); i++) {
    const diff = (bScore[i] ?? 0) - (aScore[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function getRedirectSpecificityScore(source: string): number[] {
  const parts = source.split('/').filter(Boolean)
  const score: number[] = parts.map((part) => {
    if (part === '*') return 1
    if (part.startsWith(':')) return 2
    return 3
  })
  score.push(parts.length)
  return score
}
