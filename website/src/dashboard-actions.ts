// Server actions for the Holocron dashboard.
// Client components import these directly. Every action authenticates
// via getActionRequest() → requireSession() and verifies org membership
// before mutating data. Actions throw on error and return objects on success.
//
// Authorization is resolved from the projectId: look up the project first,
// then check membership in that exact org. This avoids the pitfall where a
// user belongs to multiple orgs and findFirst picks the wrong one.

'use server'

import { ulid } from 'ulid'
import * as orm from 'drizzle-orm'
import * as schema from 'db/schema'
import { env } from 'cloudflare:workers'
import { getActionRequest, redirect } from 'spiceflow'
import { getDb, requireSession, generateApiKey, hashApiKey } from './db.ts'

async function authenticateRequest() {
  const request = getActionRequest()
  return requireSession(request)
}

/** Resolve authorization from the projectId: find the project, then check
 *  the caller is a member of the project's org. Optionally require admin role. */
async function requireProjectMembership(userId: string, projectId: string, options?: { adminOnly?: boolean }) {
  const db = getDb()

  const project = await db.query.project.findFirst({
    where: { projectId },
  })
  if (!project) throw new Error('Project not found')

  const membership = await db.query.orgMember.findFirst({
    where: { userId, orgId: project.orgId },
  })
  if (!membership) throw new Error('Not a member of this organization')

  if (options?.adminOnly && membership.role !== 'admin') {
    throw new Error('Only admins can perform this action')
  }

  return { membership, project, orgId: project.orgId }
}

// ── Create API Key ──────────────────────────────────────────────────

export async function createApiKeyAction({ name, projectId }: {
  name: string
  projectId: string
}): Promise<{ id: string; fullKey: string; prefix: string }> {
  if (!name.trim()) throw new Error('Name is required')
  if (!projectId) throw new Error('Project ID is required')

  const session = await authenticateRequest()
  const { orgId } = await requireProjectMembership(session.userId, projectId, { adminOnly: true })

  const generated = generateApiKey()
  const keyHash = await hashApiKey(generated.fullKey)
  const db = getDb()

  const id = ulid()
  await db.insert(schema.apiKey).values({
    id,
    orgId,
    projectId,
    name: name.trim(),
    prefix: generated.prefix,
    hash: keyHash,
  })

  // Return the full key; this is the only time it's ever available
  return { id, fullKey: generated.fullKey, prefix: generated.prefix }
}

// ── Invite Member ───────────────────────────────────────────────────

// ── Invite Member (link-based) ──────────────────────────────────────

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export async function createInviteAction({ orgId }: {
  orgId: string
}): Promise<{ id: string }> {
  if (!orgId) throw new Error('No org selected')

  const session = await authenticateRequest()
  const db = getDb()

  // Verify caller is admin of this org
  const membership = await db.query.orgMember.findFirst({
    where: { userId: session.userId, orgId },
  })
  if (!membership) throw new Error('Not a member of this organization')
  if (membership.role !== 'admin') throw new Error('Only admins can create invites')

  const [invite] = await db.insert(schema.orgInvitation).values({
    orgId,
    createdBy: session.userId,
    expiresAt: Date.now() + INVITE_EXPIRY_MS,
  }).returning({ id: schema.orgInvitation.id })

  return { id: invite!.id }
}

export async function acceptInviteAction({ invitationId }: {
  invitationId: string
}): Promise<never> {
  if (!invitationId) throw new Error('Invitation ID is required')

  const session = await authenticateRequest()
  const db = getDb()

  const invite = await db.query.orgInvitation.findFirst({
    where: { id: invitationId },
  })
  if (!invite || invite.expiresAt < Date.now()) throw new Error('Invitation not found or expired')

  // Insert membership; onConflictDoNothing handles already-member case
  await db.insert(schema.orgMember)
    .values({ orgId: invite.orgId, userId: session.userId, role: invite.role })
    .onConflictDoNothing({ target: [schema.orgMember.orgId, schema.orgMember.userId] })

  throw redirect(`/dashboard`)
}

// ── Create Organization ─────────────────────────────────────────────

export async function createOrgAction({ name }: {
  name: string
}): Promise<{ orgId: string }> {
  if (!name.trim()) throw new Error('Name is required')

  const session = await authenticateRequest()
  const db = getDb()

  const orgId = ulid()
  await db.batch([
    db.insert(schema.org).values({ id: orgId, name: name.trim() }),
    db.insert(schema.orgMember).values({ orgId, userId: session.userId, role: 'admin' }),
  ])

  return { orgId }
}

// ── Update Project Name ─────────────────────────────────────────────

export async function updateProjectNameAction({ projectId, name }: {
  projectId: string
  name: string
}): Promise<{ ok: true }> {
  if (!name.trim()) throw new Error('Name is required')
  if (!projectId) throw new Error('Project ID is required')

  const session = await authenticateRequest()
  await requireProjectMembership(session.userId, projectId, { adminOnly: true })

  const db = getDb()
  await db.update(schema.project)
    .set({ name: name.trim(), updatedAt: Date.now() })
    .where(orm.eq(schema.project.projectId, projectId))

  return { ok: true }
}

// ── Delete Project ──────────────────────────────────────────────────

export async function deleteProjectAction({ projectId }: {
  projectId: string
}): Promise<never> {
  if (!projectId) throw new Error('Project ID is required')

  const session = await authenticateRequest()
  await requireProjectMembership(session.userId, projectId, { adminOnly: true })

  const db = getDb()

  // Load all deployments to clean up KV site-info entries
  const deployments = await db.query.deployment.findMany({
    where: { projectId },
    columns: { subdomain: true },
  })

  // Delete site-info KV entries so the hosting worker stops serving pages
  const kvDeletes = deployments
    .filter((d) => d.subdomain)
    .map((d) => env.SITES_KV.delete(`site-info:${d.subdomain}`))
  if (kvDeletes.length > 0) await Promise.all(kvDeletes)

  // Delete the project row; cascades to deployments, api_keys, subscriptions
  await db.delete(schema.project)
    .where(orm.eq(schema.project.projectId, projectId))

  throw redirect('/dashboard')
}

// ── Google Search Console ───────────────────────────────────────────
// All OAuth proxy calls happen server-side to avoid CORS issues and to keep
// Google tokens out of the browser. The client only ever sees the consent URL
// and a readKey for completing the flow.
//
// TODO: Replace with our own OAuth proxy URL once GCP app is approved.
// Framer's open-source OAuth proxy worker source:
// https://github.com/framer/plugin-oauth (MIT license)
// Vendor this into our own CF Worker when we have our own GCP OAuth app.
//
// NOTE: The open-source repo hardcodes access_type=online, but the live
// deployment at oauth.fetch.tools uses access_type=offline + prompt=consent.
// This means refresh tokens work fine. Scopes granted by the live proxy:
// userinfo.profile, webmasters (read/write), indexing.

const GSC_OAUTH_PROXIES: Record<string, string> = {
  'framer-gsc-plugin': 'https://oauth.fetch.tools/google-search-console-plugin',
}

const DEFAULT_GSC_APP_ID = 'framer-gsc-plugin'

function getProxyUrl(appId: string): string {
  const url = GSC_OAUTH_PROXIES[appId]
  if (!url) throw new Error(`Unknown OAuth app: ${appId}`)
  return url
}

/** Step 1: Start OAuth flow. Returns consent URL for the browser to open,
 *  plus a readKey for completing the flow server-side via completeGscOAuthAction. */
export async function startGscOAuthAction({ projectId }: {
  projectId: string
}): Promise<{ url: string; readKey: string }> {
  if (!projectId) throw new Error('Project ID is required')

  const session = await authenticateRequest()
  await requireProjectMembership(session.userId, projectId, { adminOnly: true })

  // TODO: Replace with our own OAuth proxy authorize endpoint
  const proxyUrl = getProxyUrl(DEFAULT_GSC_APP_ID)
  const res = await fetch(`${proxyUrl}/authorize`, { method: 'POST' })
  if (!res.ok) throw new Error('Failed to start OAuth flow')

  return await res.json() as { url: string; readKey: string }
}

/** Step 2: Complete OAuth flow. Server polls the proxy for tokens (no tokens
 *  ever touch the browser), stores them, and returns the list of GSC sites. */
export async function completeGscOAuthAction({ projectId, readKey }: {
  projectId: string
  readKey: string
}): Promise<{ sites: Array<{ siteUrl: string; permissionLevel: string }> }> {
  if (!projectId) throw new Error('Project ID is required')
  if (!readKey) throw new Error('Read key is required')

  const session = await authenticateRequest()
  await requireProjectMembership(session.userId, projectId, { adminOnly: true })

  // TODO: Replace with our own OAuth proxy poll endpoint
  const proxyUrl = getProxyUrl(DEFAULT_GSC_APP_ID)

  // Poll for tokens (user may still be completing consent)
  let tokens: { access_token: string; expires_in: number; refresh_token?: string } | null = null
  for (let i = 0; i < 40; i++) {
    const pollRes = await fetch(`${proxyUrl}/poll?readKey=${readKey}`, { method: 'POST' })
    if (pollRes.status === 200) {
      tokens = await pollRes.json() as any
      break
    }
    await new Promise(r => setTimeout(r, 1500))
  }
  if (!tokens) throw new Error('OAuth timed out — please try again')

  const db = getDb()
  const expiresAt = Date.now() + tokens.expires_in * 1000
  const now = Date.now()

  // Upsert: replace existing connection for this project.
  // Only overwrite refreshToken if Google sent a new one — Framer's proxy
  // uses access_type=online so refresh tokens may be absent on re-auth.
  await db.insert(schema.gscConnection).values({
    projectId,
    oauthAppId: DEFAULT_GSC_APP_ID,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: schema.gscConnection.projectId,
    set: {
      oauthAppId: DEFAULT_GSC_APP_ID,
      accessToken: tokens.access_token,
      // Preserve existing refresh token if Google didn't send a new one
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiresAt,
      updatedAt: now,
    },
  })

  // Fetch available GSC sites with the fresh token
  const sitesRes = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!sitesRes.ok) throw new Error('Failed to fetch Google Search Console sites')

  const data = await sitesRes.json() as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> }
  return { sites: data.siteEntry || [] }
}

export async function disconnectGscAction({ projectId }: {
  projectId: string
}): Promise<{ ok: true }> {
  if (!projectId) throw new Error('Project ID is required')

  const session = await authenticateRequest()
  await requireProjectMembership(session.userId, projectId, { adminOnly: true })

  const db = getDb()
  await db.delete(schema.gscConnection)
    .where(orm.eq(schema.gscConnection.projectId, projectId))
    .limit(1)

  return { ok: true }
}

export async function selectGscSiteAction({ projectId, siteUrl }: {
  projectId: string
  siteUrl: string
}): Promise<{ ok: true }> {
  if (!projectId) throw new Error('Project ID is required')
  if (!siteUrl) throw new Error('Site URL is required')

  const session = await authenticateRequest()
  await requireProjectMembership(session.userId, projectId, { adminOnly: true })

  // Validate that the siteUrl is actually available for this Google account
  const { sites } = await fetchGscSites(projectId)
  if (!sites.some(s => s.siteUrl === siteUrl)) {
    throw new Error('Selected site is not available for this Google account')
  }

  const db = getDb()
  await db.update(schema.gscConnection)
    .set({ siteUrl, updatedAt: Date.now() })
    .where(orm.eq(schema.gscConnection.projectId, projectId))
    .limit(1)

  return { ok: true }
}

/** Internal helper: fetches GSC sites using stored tokens, refreshing if expired.
 *  No auth check — callers must verify permissions before calling.
 *  TODO: Replace Framer proxy refresh endpoint with our own once GCP app is approved. */
async function fetchGscSites(projectId: string): Promise<{ sites: Array<{ siteUrl: string; permissionLevel: string }> }> {
  const db = getDb()
  const connection = await db.query.gscConnection.findFirst({
    where: { projectId },
  })
  if (!connection) throw new Error('No Google Search Console connection found')

  let { accessToken, refreshToken, expiresAt } = connection

  // Refresh token if expired
  if (expiresAt && expiresAt < Date.now() && refreshToken) {
    const proxyUrl = getProxyUrl(connection.oauthAppId)

    const refreshRes = await fetch(
      `${proxyUrl}/refresh?code=${encodeURIComponent(refreshToken)}`,
      { method: 'POST' },
    )
    if (!refreshRes.ok) throw new Error('Failed to refresh Google token')

    const refreshData = await refreshRes.json() as { access_token: string; expires_in: number }
    accessToken = refreshData.access_token
    const newExpiresAt = Date.now() + refreshData.expires_in * 1000

    // Update stored tokens
    await db.update(schema.gscConnection)
      .set({ accessToken, expiresAt: newExpiresAt, updatedAt: Date.now() })
      .where(orm.eq(schema.gscConnection.projectId, projectId))
      .limit(1)
  }

  // Fetch sites from Google
  const sitesRes = await fetch('https://searchconsole.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!sitesRes.ok) throw new Error('Failed to fetch Google Search Console sites')

  const data = await sitesRes.json() as { siteEntry?: Array<{ siteUrl: string; permissionLevel: string }> }
  return { sites: data.siteEntry || [] }
}

export async function listGscSitesAction({ projectId }: {
  projectId: string
}): Promise<{ sites: Array<{ siteUrl: string; permissionLevel: string }> }> {
  if (!projectId) throw new Error('Project ID is required')

  const session = await authenticateRequest()
  await requireProjectMembership(session.userId, projectId, { adminOnly: true })

  return fetchGscSites(projectId)
}
