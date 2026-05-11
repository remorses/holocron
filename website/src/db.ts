// Worker-level database client, auth, and session helpers.
//
// getDb() creates a drizzle-orm/d1 client bound to env.DB.
// getAuth() creates a BetterAuth instance with Google social login + device flow.

import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from 'db/schema'
import { betterAuth } from 'better-auth'
import { deviceAuthorization, bearer } from 'better-auth/plugins'
import { drizzleAdapter } from '@better-auth/drizzle-adapter/relations-v2'
import { json } from 'spiceflow'

// ── Drizzle client via D1 ───────────────────────────────────────────

export function getDb() {
  return drizzle(env.DB, { schema, relations: schema.relations })
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
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        prompt: 'select_account',
      },
    },
    plugins: [
      deviceAuthorization({ verificationUri: '/device', schema: {} }),
      bearer(),
    ],
  })
}

function getBaseUrl(): string {
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

type Session = { userId: string; user: { id: string; name: string; email: string } }

type RequestHeaders = Pick<Request, 'headers'>

export async function getSession(request: RequestHeaders): Promise<Session | null> {
  const hasCookie = request.headers.has('cookie')
  const hasAuthorization = request.headers.has('authorization')
  if (!hasCookie && !hasAuthorization) {
    return null
  }
  const auth = getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null
  return {
    userId: session.user.id,
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
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

/** Get or create the user's org. Idempotent and race-safe:
 *  if two concurrent requests both try to create, the loser catches
 *  the unique constraint error and re-reads the winner's row. */
export async function ensureOrg(userId: string, userName: string): Promise<{ id: string; name: string }> {
  const db = getDb()
  const existing = await db.query.orgMember.findFirst({
    where: { userId },
    with: { org: true },
  })
  if (existing?.org) {
    return { id: existing.org.id, name: existing.org.name }
  }

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

// ── API key validation ──────────────────────────────────────────────

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


