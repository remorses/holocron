// Worker-level database client, auth, and session helpers.
//
// getDb() creates a drizzle-orm/sqlite-proxy client bound to env.DB.
// Uses sqlite-proxy instead of drizzle-orm/d1 to avoid the batch findFirst
// crash (drizzle-team/drizzle-orm#2721).
// getAuth() creates a BetterAuth instance with GitHub social login + device flow.
//
// Performance: org lookups are memoized via Cache API. API key validation
// is NOT cached to avoid deleted keys staying valid during the cache window.
// (5-10 min fresh, SWR) so repeated cross-region D1 queries are ~1-5ms
// instead of 50-200ms. null results are never cached so deleted keys
// and new users are immediately visible.

import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import * as schema from 'db/schema'
import { betterAuth } from 'better-auth/minimal'
import { deviceAuthorization, bearer } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth-drizzle-adapter'
import { strataBetterAuth } from '@strada.sh/sdk/better-auth'
import { json } from 'spiceflow'
import { memoize } from './lib/memoize.ts'
import { ACTIVE_SUBSCRIPTION_STATUSES } from './lib/billing-rules.ts'

// ── Drizzle client via D1 ───────────────────────────────────────────

function d1ToRawRows(results: Record<string, unknown>[]) {
  return results.map((row) => Object.keys(row).map((k) => row[k]))
}

export function getDb() {
  return drizzle(
    async (sql, params, method) => {
      const stmt = env.DB.prepare(sql).bind(...params)
      if (method === 'run') { await stmt.run(); return { rows: [] as any[] } }
      const rows = await stmt.raw()
      if (method === 'get') return { rows: rows[0] as any }
      return { rows: rows as any[] }
    },
    async (queries) => {
      const stmts = queries.map((q) => env.DB.prepare(q.sql).bind(...q.params))
      const results = await env.DB.batch(stmts)
      return results.map((r, i) => {
        const rows = d1ToRawRows(r.results as Record<string, unknown>[])
        if (queries[i]!.method === 'get') return { rows: rows[0] as any }
        return { rows: rows as any[] }
      })
    },
    { schema, relations: schema.relations },
  )
}

// ── BetterAuth ──────────────────────────────────────────────────────

export function getAuth() {
  const db = getDb()
  return betterAuth({
    baseURL: getBaseUrl(),
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'sqlite' }),
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    plugins: [
      deviceAuthorization({ verificationUri: '/device', schema: {} }),
      bearer(),
      strataBetterAuth(),
    ],
  })
}

export function getBaseUrl(): string {
  // BETTER_AUTH_URL comes from wrangler.jsonc [vars] per environment.
  // Production: https://holocron.so, Preview: https://preview.holocron.so.
  // In local dev, wrangler injects the var from the top-level config; the code
  // below falls back to https://holocron.so if nothing is set.
  const override = env.BETTER_AUTH_URL
  if (typeof override === 'string' && override) return override
  return 'https://holocron.so'
}

// ── API key helpers ─────────────────────────────────────────────────

export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function generateApiKey(): { fullKey: string; prefix: string } {
  const raw = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const fullKey = `holo_${raw}`
  const prefix = raw.slice(0, 12)
  return { fullKey, prefix }
}

// ── Session helpers ─────────────────────────────────────────────────

type Session = { userId: string; user: { id: string; name: string; email: string; image: string | null } }

type RequestHeaders = Pick<Request, 'headers'>

/** Memoized bearer token session lookup. BetterAuth's cookieCache only
 *  covers cookie-based auth (browser dashboard). CLI requests use bearer
 *  tokens which hit D1 on every call without this cache layer.
 *  2 min fresh, 5 min SWR. null results are never cached (memoize
 *  convention) so invalid tokens always get a fresh D1 check. */
const resolveBearerSession = memoize({
  namespace: 'bearer-session',
  fn: async (token: string): Promise<Session | null> => {
    const auth = getAuth()
    const session = await auth.api.getSession({
      headers: new Headers({ authorization: `Bearer ${token}` }),
    })
    if (!session) return null
    return {
      userId: session.user.id,
      user: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null },
    }
  },
  ttl: 120,
  swr: 300,
})

export async function getSession(request: RequestHeaders): Promise<Session | null> {
  const hasCookie = request.headers.has('cookie')
  const hasAuthorization = request.headers.has('authorization')
  if (!hasCookie && !hasAuthorization) {
    return null
  }

  // Bearer tokens from CLI: use memoized lookup to avoid D1 on every request.
  // Cookie-based requests (dashboard): let BetterAuth handle its own cookieCache.
  if (hasAuthorization && !hasCookie) {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (token && !token.startsWith('holo_')) {
      return resolveBearerSession(token)
    }
  }

  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null
  return {
    userId: session.user.id,
    user: { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null },
  }
}

export async function requireSession(request: RequestHeaders): Promise<Session> {
  const session = await getSession(request)
  if (!session) {
    throw json({ error: 'unauthorized' }, { status: 401 })
  }
  return session
}

// ── Org helpers ─────────────────────────────────────────────────────

/** D1 lookup for user's org membership — memoized via Cache API (10 min
 *  fresh, 20 min SWR). Returns null if user has no org yet, which is
 *  never cached so the create path in ensureOrg is always fresh. */
const findOrgForUser = memoize({
  namespace: 'user-org',
  fn: async (userId: string): Promise<{ id: string; name: string } | null> => {
    const db = getDb()
    const existing = await db.query.orgMember.findFirst({
      where: { userId },
      with: { org: true },
    })
    if (!existing?.org) return null
    return { id: existing.org.id, name: existing.org.name }
  },
  ttl: 600,
  swr: 1200,
})

/** Get or create the user's org. Idempotent and race-safe:
 *  if two concurrent requests both try to create, the loser catches
 *  the unique constraint error and re-reads the winner's row.
 *  The lookup is memoized; the create path always hits D1.
 *
 *  When `targetOrgId` is provided, returns that specific org instead of the
 *  user's default. Validates the user is a member of the target org;
 *  throws 403 if not. Does NOT auto-create an org when a target is given. */
export async function ensureOrg(
  userId: string,
  userName: string,
  targetOrgId?: string,
): Promise<{ id: string; name: string }> {
  if (targetOrgId) {
    const db = getDb()
    const membership = await db.query.orgMember.findFirst({
      where: { userId, orgId: targetOrgId },
      with: { org: true },
    })
    if (!membership?.org) {
      throw json({ error: 'not a member of the specified org' }, { status: 403 })
    }
    return { id: membership.org.id, name: membership.org.name }
  }

  const cached = await findOrgForUser(userId)
  if (cached) return cached

  // No org found (null is never cached) — create one
  const db = getDb()
  const { ulid } = await import('ulid')
  const orgId = ulid()
  try {
    await db.batch([
      db.insert(schema.org).values({ id: orgId, name: userName }),
      db.insert(schema.orgMember).values({ orgId, userId, role: 'admin' }),
    ])
    return { id: orgId, name: userName }
  } catch (err) {
    // Race: another request already created the org for this user.
    // Re-read the winning row.
    const winner = await db.query.orgMember.findFirst({
      where: { userId },
      with: { org: true },
    })
    if (winner?.org) return { id: winner.org.id, name: winner.org.name }
    throw err
  }
}

// ── Subscription helpers ────────────────────────────────────────────

export type ProjectSubscription = {
  subscriptionId: string
  status: string
  interval: 'month' | 'year' | null
  currentPeriodEnd: number | null
  cancelAtPeriodEnd: boolean
}

/** Return the project's active subscription (active | trialing | past_due), or
 *  null if the project has no paid subscription. NOT memoized: billing state
 *  must reflect the latest webhook immediately, otherwise a just-subscribed user
 *  would stay blocked until a cache TTL expired. The D1 query is a single
 *  indexed lookup, fast enough to run per request. */
export async function getProjectSubscription(projectId: string): Promise<ProjectSubscription | null> {
  const db = getDb()
  const active = await db.query.subscription.findFirst({
    where: { projectId, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
  })
  if (!active) return null
  return {
    subscriptionId: active.subscriptionId,
    status: active.status,
    interval: active.interval ?? null,
    currentPeriodEnd: active.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: active.cancelAtPeriodEnd ?? false,
  }
}

/** Get all orgs a user is a member of, with their role. */
export async function getOrgsForUser(userId: string): Promise<Array<{ id: string; name: string; role: string }>> {
  const db = getDb()
  const memberships = await db.query.orgMember.findMany({
    where: { userId },
    with: { org: true },
  })
  return memberships
    .filter((m) => m.org)
    .map((m) => ({ id: m.org!.id, name: m.org!.name, role: m.role }))
}

// ── API key validation ──────────────────────────────────────────────

// NOT memoized. Caching auth lookups means deleted keys stay valid for the
// cache TTL window, which is a security risk for deploy credentials. The D1
// query is fast enough (<10ms in-region) and runs once per request at most.

export async function validateApiKey(authHeader: string | null): Promise<{ orgId: string; keyId: string; projectId: string } | null> {
  if (!authHeader) return null
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (!token.startsWith('holo_')) return null

  const hash = await hashApiKey(token)
  const db = getDb()
  const found = await db.query.apiKey.findFirst({
    where: { hash },
  })
  if (!found) return null
  return { orgId: found.orgId, keyId: found.id, projectId: found.projectId }
}

// ── Management API auth (session OR api-key) ─────────────────────────

/** Auth context for the `/api/v0/*` management endpoints. Either a signed-in
 *  BetterAuth session (browser/dashboard/device-flow) or a project-scoped
 *  `holo_xxx` API key. API keys are NOT impersonated as a user: they are a
 *  service principal pinned to one org + one project. Each route constrains
 *  api-key callers to `projectId` so a key for project A cannot touch
 *  project B in the same org. */
export type ManagementAuth =
  | { type: 'session'; userId: string; orgId: string; userName: string }
  | { type: 'api-key'; orgId: string; projectId: string; keyId: string }

/** Resolve management-API auth. Prefers a `holo_xxx` API key in the
 *  Authorization header, otherwise falls back to a signed-in session.
 *  Throws 401 when neither is present/valid.
 *
 *  Cost: validateApiKey does ZERO D1 reads unless the Authorization header
 *  actually carries a `holo_` token (it short-circuits on a null header and
 *  on the `holo_` prefix check before hashing or querying). So no-auth and
 *  cookie/device-flow requests pay no extra D1 reads vs the old requireSession
 *  path — the api-key lookup only runs for real api-key requests, and then it
 *  returns immediately without calling getSession/ensureOrg.
 *
 *  validateApiKey is not memoized, so revoked keys stop working immediately. */
export async function requireManagementAuth(request: RequestHeaders): Promise<ManagementAuth> {
  const apiKey = await validateApiKey(request.headers.get('authorization'))
  if (apiKey) {
    return { type: 'api-key', orgId: apiKey.orgId, projectId: apiKey.projectId, keyId: apiKey.keyId }
  }

  const session = await getSession(request)
  if (!session) {
    throw json({ error: 'unauthorized' }, { status: 401 })
  }
  const org = await ensureOrg(session.userId, session.user.name)
  return { type: 'session', userId: session.userId, orgId: org.id, userName: session.user.name }
}
