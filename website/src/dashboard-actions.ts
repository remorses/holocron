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
