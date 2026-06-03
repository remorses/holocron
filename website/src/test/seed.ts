// Seed helpers for the workers-pool API tests. Holocron auth is GitHub-only
// (no email/password signup), so tests cannot mint users/tokens via
// auth.api.signUpEmail. Instead we insert real rows directly into the test D1:
// a user + a session row (so a `Bearer <token>` request authenticates via the
// BetterAuth bearer plugin), an org + membership, projects, and API keys
// (hashed exactly like production via generateApiKey/hashApiKey).
//
// Everything uses ULIDs so we never collide across tests; each test seeds its
// own fresh org/user.
import { getDb, generateApiKey, hashApiKey } from '../db.ts'
import * as schema from 'db/schema'
import { ulid } from 'ulid'

const YEAR_MS = 1000 * 60 * 60 * 24 * 365

export interface SeededUser {
  userId: string
  /** Send as `Authorization: Bearer <sessionToken>` to authenticate as a session. */
  sessionToken: string
  name: string
  email: string
}

/** Insert a user + a non-expired session row. The session token works as a
 *  bearer token because the BetterAuth bearer plugin looks the session up by
 *  token in the session table. */
export async function seedUserWithSession(
  opts: { name?: string } = {},
): Promise<SeededUser> {
  const db = getDb()
  const userId = ulid()
  const name = opts.name ?? `Test User ${userId.slice(-6)}`
  const email = `${userId.toLowerCase()}@example.test`
  const sessionToken = `sess_${ulid()}${ulid()}`

  await db.insert(schema.user).values({ id: userId, name, email })
  await db.insert(schema.session).values({
    id: ulid(),
    userId,
    token: sessionToken,
    expiresAt: Date.now() + YEAR_MS,
  })

  return { userId, sessionToken, name, email }
}

/** Insert an org and make the user an admin member. Returns the org id. */
export async function seedOrg(
  userId: string,
  opts: { name?: string; role?: 'admin' | 'member' } = {},
): Promise<string> {
  const db = getDb()
  const orgId = ulid()
  await db.insert(schema.org).values({ id: orgId, name: opts.name ?? `Org ${orgId.slice(-6)}` })
  await db.insert(schema.orgMember).values({
    id: ulid(),
    orgId,
    userId,
    role: opts.role ?? 'admin',
  })
  return orgId
}

/** Add an existing user to an existing org with a given role (default member). */
export async function seedMembership(
  orgId: string,
  userId: string,
  role: 'admin' | 'member' = 'member',
): Promise<void> {
  const db = getDb()
  await db.insert(schema.orgMember).values({ id: ulid(), orgId, userId, role })
}

/** Insert a project in an org. Returns the projectId. */
export async function seedProject(
  orgId: string,
  opts: { name?: string } = {},
): Promise<string> {
  const db = getDb()
  const projectId = ulid()
  await db.insert(schema.project).values({
    projectId,
    orgId,
    name: opts.name ?? `Project ${projectId.slice(-6)}`,
  })
  return projectId
}

export interface SeededApiKey {
  keyId: string
  /** The full `holo_xxx` secret — send as `Authorization: Bearer <fullKey>`. */
  fullKey: string
}

/** Insert an API key scoped to a project, hashed exactly like production. */
export async function seedApiKey(
  orgId: string,
  projectId: string,
  opts: { name?: string } = {},
): Promise<SeededApiKey> {
  const db = getDb()
  const keyId = ulid()
  const { fullKey, prefix } = generateApiKey()
  const hash = await hashApiKey(fullKey)
  await db.insert(schema.apiKey).values({
    id: keyId,
    orgId,
    projectId,
    name: opts.name ?? 'test key',
    prefix,
    hash,
  })
  return { keyId, fullKey }
}

/** Authorization header object for a bearer token (session token or holo_ key). */
export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` }
}
