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
  opts: { name?: string; role?: 'admin' | 'member'; plan?: schema.OrgPlan } = {},
): Promise<string> {
  const db = getDb()
  const orgId = ulid()
  await db.insert(schema.org).values({
    id: orgId,
    name: opts.name ?? `Org ${orgId.slice(-6)}`,
    plan: opts.plan ?? 'free',
  })
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
  opts: {
    name?: string
    subdomain?: string
    source?: string
    externalId?: string
    currentDeploymentId?: string
  } = {},
): Promise<string> {
  const db = getDb()
  const projectId = ulid()
  await db.insert(schema.project).values({
    projectId,
    orgId,
    name: opts.name ?? `Project ${projectId.slice(-6)}`,
    subdomain: opts.subdomain ?? null,
    source: opts.source ?? null,
    externalId: opts.externalId ?? null,
    currentDeploymentId: opts.currentDeploymentId ?? null,
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
    scope: 'project',
    name: opts.name ?? 'test key',
    prefix,
    hash,
  })
  return { keyId, fullKey }
}

/** Insert an org-scoped API key (control plane). projectId is null. */
export async function seedOrgApiKey(
  orgId: string,
  opts: { name?: string } = {},
): Promise<SeededApiKey> {
  const db = getDb()
  const keyId = ulid()
  const { fullKey, prefix } = generateApiKey()
  const hash = await hashApiKey(fullKey)
  await db.insert(schema.apiKey).values({
    id: keyId,
    orgId,
    projectId: null,
    scope: 'org',
    name: opts.name ?? 'org key',
    prefix,
    hash,
  })
  return { keyId, fullKey }
}

export interface SeededDeployment {
  id: string
  version: string
}

/** Insert a deployment row for a project. Returns the deployment id and version. */
export async function seedDeployment(
  projectId: string,
  opts: {
    status?: 'uploading' | 'active' | 'superseded'
    branch?: string
    preview?: boolean
    subdomain?: string
    githubActor?: string
    triggeredByUserId?: string
  } = {},
): Promise<SeededDeployment> {
  const db = getDb()
  const id = ulid()
  const version = ulid()
  await db.insert(schema.deployment).values({
    id,
    projectId,
    version,
    status: opts.status ?? 'active',
    branch: opts.branch ?? 'main',
    preview: opts.preview ?? false,
    subdomain: opts.subdomain ?? null,
    githubActor: opts.githubActor ?? null,
    triggeredByUserId: opts.triggeredByUserId ?? null,
  })
  return { id, version }
}

/** Insert a subscription row for a project. Returns the subscription id. */
export async function seedSubscription(
  orgId: string,
  projectId: string,
  opts: {
    status?: string
    interval?: 'month' | 'year'
  } = {},
): Promise<string> {
  const db = getDb()
  const id = ulid()
  await db.insert(schema.subscription).values({
    id,
    subscriptionId: `sub_${ulid()}`,
    orgId,
    projectId,
    customerId: `cus_${ulid()}`,
    priceId: `price_${ulid()}`,
    productId: `prod_${ulid()}`,
    status: opts.status ?? 'active',
    interval: opts.interval ?? 'month',
    currentPeriodEnd: Date.now() + YEAR_MS,
    cancelAtPeriodEnd: false,
  })
  return id
}

/** Insert a custom domain row for a project. Returns the domain id. */
export async function seedDomain(
  projectId: string,
  opts: {
    hostname?: string
    status?: string
    sslStatus?: string
  } = {},
): Promise<string> {
  const db = getDb()
  const id = ulid()
  await db.insert(schema.domain).values({
    id,
    projectId,
    hostname: opts.hostname ?? `${ulid().toLowerCase().slice(-8)}.example.com`,
    status: opts.status ?? 'active',
    sslStatus: opts.sslStatus ?? 'active',
  })
  return id
}

/** Authorization header object for a bearer token (session token or holo_ key). */
export function bearer(token: string): { authorization: string } {
  return { authorization: `Bearer ${token}` }
}
