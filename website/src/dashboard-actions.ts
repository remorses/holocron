// Server actions for the Holocron dashboard.
// Client components import these directly. Every action authenticates
// via getActionRequest() → requireSession() and verifies org membership
// before mutating data. Actions throw on error and return objects on success.

'use server'

import { ulid } from 'ulid'
import * as orm from 'drizzle-orm'
import * as schema from 'db/schema'
import { getActionRequest } from 'spiceflow'
import { getDb, requireSession, ensureOrg, generateApiKey, hashApiKey } from './db.ts'

async function authenticateRequest() {
  const request = getActionRequest()
  return requireSession(request)
}

async function requireOrgMembership(userId: string, projectId: string) {
  const db = getDb()
  const membership = await db.query.orgMember.findFirst({
    where: { userId },
  })
  if (!membership) throw new Error('Not a member of any organization')

  const project = await db.query.project.findFirst({
    where: { projectId, orgId: membership.orgId },
  })
  if (!project) throw new Error('Project not found')

  return { membership, project, orgId: membership.orgId }
}

// ── Create Project ──────────────────────────────────────────────────

export async function createProjectAction({ name }: {
  name: string
}): Promise<{ projectId: string }> {
  if (!name.trim()) throw new Error('Name is required')

  const session = await authenticateRequest()
  const org = await ensureOrg(session.userId, session.user.name)
  const db = getDb()

  const projectId = ulid()
  const generated = generateApiKey()
  const keyHash = await hashApiKey(generated.fullKey)

  await db.batch([
    db.insert(schema.project).values({
      projectId,
      orgId: org.id,
      name: name.trim(),
    }),
    db.insert(schema.apiKey).values({
      id: ulid(),
      orgId: org.id,
      projectId,
      name: 'deploy',
      prefix: generated.prefix,
      hash: keyHash,
    }),
  ])

  return { projectId }
}

// ── Create API Key ──────────────────────────────────────────────────

export async function createApiKeyAction({ name, projectId }: {
  name: string
  projectId: string
}): Promise<{ id: string; fullKey: string; prefix: string }> {
  if (!name.trim()) throw new Error('Name is required')
  if (!projectId) throw new Error('Project ID is required')

  const session = await authenticateRequest()
  const { orgId } = await requireOrgMembership(session.userId, projectId)

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
  const { orgId } = await requireOrgMembership(session.userId, projectId)

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
