/**
 * Config-driven URL redirects.
 *
 * Compiles `config.redirects[]` rules into a fast lookup table and
 * exposes a `.use()` middleware helper that installs them on a
 * Spiceflow app. Runs BEFORE any loader/layout/page, so redirects
 * short-circuit the request with minimal work.
 *
 * Supported source patterns (Mintlify compatible):
 *
 *   - Exact match:       "/old"              → "/new"
 *   - Named parameters:  "/users/:id"        → "/u/:id"
 *   - Trailing wildcard: "/blog/*"           → "/posts/:splat"
 *   - Combined:          "/docs/:section/*"  → "/d/:section/:splat"
 *
 * Exact paths are checked first via a Map (O(1) lookup). Pattern
 * rules (with `:param` or `*`) are matched linearly in declaration
 * order. This guarantees exact matches beat patterns regardless of
 * declaration order — so `/users/new` beats `/users/:id` even if
 * declared later.
 *
 * Why not `.get()` / `.loader()` / `.page()` routes + spiceflow's
 * trie router? See MEMORY.md → "Redirects in spiceflow — stuck with
 * a custom regex matcher + `.use()` middleware" for the full
 * investigation and why this is the simplest reliable option.
 */
import type { Spiceflow } from 'spiceflow'
import { redirect } from 'spiceflow'
import type { HolocronConfig } from '../config.ts'

type ConfigRedirect = HolocronConfig['redirects'][number]

export type CompiledRedirect = {
  source: string
  destination: string
  permanent: boolean
  /** Compiled matcher; returns captured params or `null` if no match. */
  match: (path: string) => Record<string, string> | null
}

/** An optimized redirect table. Exact matches (no params, no wildcard)
 *  are keyed in a Map for O(1) lookup; pattern rules fall through to
 *  linear matching. Exact-path rules ALWAYS win over pattern rules, so
 *  `/users/new` beats `/users/:id` regardless of declaration order. */
export type RedirectTable = {
  exact: Map<string, CompiledRedirect>
  patterns: CompiledRedirect[]
}

export type RedirectMatch = {
  destination: string
  permanent: boolean
}

/** Build an optimized redirect table from raw config rules. */
export function buildRedirectTable(rules: ConfigRedirect[]): RedirectTable {
  const exact = new Map<string, CompiledRedirect>()
  const patterns: CompiledRedirect[] = []
  for (const rule of rules) {
    const compiled: CompiledRedirect = {
      source: rule.source,
      destination: rule.destination,
      permanent: rule.permanent ?? false,
      match: compileSourcePattern(rule.source),
    }
    if (isExactSource(rule.source)) {
      // First-write-wins: if the same exact source is declared twice,
      // the earlier rule keeps precedence.
      if (!exact.has(rule.source)) exact.set(rule.source, compiled)
    } else {
      patterns.push(compiled)
    }
  }
  return { exact, patterns }
}

/** Match a request path against the redirect table.
 *  Exact matches take precedence; fall back to pattern rules in order. */
export function matchRedirect(
  table: RedirectTable,
  path: string,
): RedirectMatch | null {
  const exactHit = table.exact.get(path)
  if (exactHit) {
    return {
      destination: exactHit.destination,
      permanent: exactHit.permanent,
    }
  }
  for (const rule of table.patterns) {
    const params = rule.match(path)
    if (params !== null) {
      return {
        destination: interpolateDestination(rule.destination, params),
        permanent: rule.permanent,
      }
    }
  }
  return null
}

/** Install config-driven redirect rules on a Spiceflow app as `.use()`
 *  middleware. Runs before any loader/layout/page — on match, throws
 *  a redirect Response that short-circuits the request pipeline. */
export function registerRedirects<App extends Spiceflow<any, any, any, any, any, any>>(
  app: App,
  rules: ConfigRedirect[],
): App {
  const table = buildRedirectTable(rules)
  const hasRules = table.exact.size > 0 || table.patterns.length > 0
  if (!hasRules) return app

  return app.use(async ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    const match = matchRedirect(table, url.pathname)
    if (!match) return
    // Preserve the incoming query string + hash when the destination
    // doesn't specify its own, so `GET /old?ref=x` → `/new?ref=x`.
    let destination = match.destination
    if (!destination.includes('?') && url.search) destination += url.search
    if (!destination.includes('#') && url.hash) destination += url.hash
    throw redirect(destination, {
      status: match.permanent ? 301 : 302,
    })
  }) as App
}

/* ── Pattern compiler ──────────────────────────────────────────────── */

/**
 * Compile a source pattern into a matcher function. Supports:
 *   - `:name` — captures a single path segment into `params.name`
 *   - `*`     — captures the rest of the path into `params.splat`
 *
 * Returns a function that takes a pathname and returns either the
 * captured params object (possibly empty) or `null` if no match.
 */
function compileSourcePattern(source: string): (path: string) => Record<string, string> | null {
  // Fast path for exact matches (no special chars)
  if (isExactSource(source)) {
    return (path) => (path === source ? {} : null)
  }

  // Split into segments and build a regex with named captures
  const segments = source.split('/')
  const paramNames: string[] = []
  let hasSplat = false

  const regexParts = segments.map((seg) => {
    if (seg === '*') {
      hasSplat = true
      return '(.*)'
    }
    if (seg.startsWith(':')) {
      paramNames.push(seg.slice(1))
      return '([^/]+)'
    }
    return escapeRegex(seg)
  })

  const regex = new RegExp('^' + regexParts.join('/') + '$')

  return (path) => {
    const match = regex.exec(path)
    if (!match) return null
    const params: Record<string, string> = {}
    let idx = 0
    for (const name of paramNames) {
      idx++
      params[name] = match[idx] ?? ''
    }
    if (hasSplat) {
      idx++
      params.splat = match[idx] ?? ''
    }
    return params
  }
}

/** Substitute `:name` and `:splat` placeholders in a destination template. */
export function interpolateDestination(template: string, params: Record<string, string>): string {
  return template.replace(/:(\w+)/g, (_, name: string) => {
    return params[name] ?? ''
  })
}

/** An exact source has no `:param` or `*` wildcards. */
export function isExactSource(source: string): boolean {
  return !source.includes(':') && !source.includes('*')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
