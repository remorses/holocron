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
import * as schema from 'db/schema'
import { getActionRequest, redirect } from 'spiceflow'
import { getDb, requireSession, ensureOrg, generateApiKey, hashApiKey } from './db.ts'
import { deployKeyCookie } from './dashboard-cookies.ts'

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

// ── Create Project ──────────────────────────────────────────────────

export async function createProjectAction({ name, orgId }: {
  name: string
  orgId?: string
}): Promise<never> {
  if (!name.trim()) throw new Error('Name is required')

  const request = getActionRequest()
  const session = await requireSession(request)

  // Use provided orgId or fall back to ensureOrg (creates one if needed)
  let resolvedOrgId: string
  if (orgId) {
    const db = getDb()
    const membership = await db.query.orgMember.findFirst({
      where: { userId: session.userId, orgId },
    })
    if (!membership) throw new Error('Not a member of this organization')
    resolvedOrgId = orgId
  } else {
    const org = await ensureOrg(session.userId, session.user.name)
    resolvedOrgId = org.id
  }

  const db = getDb()
  const projectId = ulid()
  const generated = generateApiKey()
  const keyHash = await hashApiKey(generated.fullKey)

  await db.batch([
    db.insert(schema.project).values({
      projectId,
      orgId: resolvedOrgId,
      name: name.trim(),
    }),
    db.insert(schema.apiKey).values({
      id: ulid(),
      orgId: resolvedOrgId,
      projectId,
      name: 'deploy',
      prefix: generated.prefix,
      hash: keyHash,
    }),
  ])

  // Redirect with deploy-key cookie so the deploy page can show the key
  throw redirect(`/dashboard/deploy?projectId=${projectId}`, {
    headers: {
      'Set-Cookie': deployKeyCookie({ request, projectId, fullKey: generated.fullKey }),
    },
  })
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

export async function inviteMemberAction({ email, projectId }: {
  email: string
  projectId: string
}): Promise<{ memberId: string; userName: string }> {
  if (!email.trim()) throw new Error('Email is required')
  if (!projectId) throw new Error('Project ID is required')

  const session = await authenticateRequest()
  const { orgId } = await requireProjectMembership(session.userId, projectId, { adminOnly: true })

  const db = getDb()

  // Check if user exists by email
  const targetUser = await db.query.user.findFirst({
    where: { email: email.trim().toLowerCase() },
  })
  if (!targetUser) {
    throw new Error('No user found with that email. They need to sign up first.')
  }

  // Check if already a member
  const existing = await db.query.orgMember.findFirst({
    where: { orgId, userId: targetUser.id },
  })
  if (existing) {
    throw new Error('This user is already a member of this organization')
  }

  // Add as member
  const [member] = await db.insert(schema.orgMember)
    .values({ orgId, userId: targetUser.id, role: 'member' })
    .returning({ id: schema.orgMember.id })

  return { memberId: member!.id, userName: targetUser.name }
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
