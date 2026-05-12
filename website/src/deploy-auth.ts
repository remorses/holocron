// Shared deploy authentication for API keys, BetterAuth sessions, and GitHub OIDC.
// GitHub Actions deployments stay keyless: the verified OIDC token identifies
// the repository, branch, preview state, Holocron user, org, and project.

import * as jose from 'jose'
import * as orm from 'drizzle-orm'
import { json } from 'spiceflow'
import { ulid } from 'ulid'
import * as schema from 'db/schema'
import { ensureOrg, getDb, getSession, validateApiKey } from './db.ts'

export const GITHUB_OIDC_HEADER = 'x-holocron-github-oidc-token'

const GITHUB_OIDC_JWKS = jose.createRemoteJWKSet(
  new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),
)

/** Sanitize a string for use in DNS hostnames. Only [a-z0-9-], max 63 chars. */
export function sanitizeForDns(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Build the project's base subdomain from github info or projectId.
 *  Format: `{repo}-{owner}` for OIDC projects, `{projectId}` for manual ones. */
export function buildProjectSubdomain(project: {
  githubOwner?: string | null
  githubRepo?: string | null
  projectId: string
}): string {
  if (project.githubOwner && project.githubRepo) {
    const raw = `${project.githubRepo}-${project.githubOwner}`
    const sanitized = sanitizeForDns(raw)
    if (sanitized.length <= 63) return sanitized
    const hashNum = [...raw].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
    const suffix = Math.abs(hashNum).toString(36).slice(0, 6)
    return `${sanitized.slice(0, 63 - suffix.length - 1).replace(/-$/, '')}-${suffix}`
  }
  return project.projectId.toLowerCase()
}

type OidcResult = {
  ownerIdStr: string
  owner: string
  repo: string
  ref?: string
  headRef?: string
  baseRef?: string
}

export type DeployAuth =
  | { type: 'api-key'; orgId: string; projectId: string }
  | { type: 'session'; orgId: string; projectId: string }
  | {
      type: 'github-oidc'
      orgId: string
      projectId: string
      githubOwner: string
      githubRepo: string
      branch: string
      preview: boolean
    }

export async function resolveCreateDeployAuth(request: Request, bodyProjectId?: string): Promise<DeployAuth> {
  const apiKeyAuth = await validateApiKey(request.headers.get('authorization'))
  if (apiKeyAuth) {
    return { type: 'api-key', orgId: apiKeyAuth.orgId, projectId: apiKeyAuth.projectId }
  }

  const session = await getSession(request)
  if (session) {
    const org = await ensureOrg(session.userId, session.user.name)
    if (!bodyProjectId) {
      throw json({ error: 'projectId is required when using session auth' }, { status: 400 })
    }

    const db = getDb()
    const proj = await db.query.project.findFirst({
      where: { projectId: bodyProjectId, orgId: org.id },
    })
    if (!proj) {
      throw json({ error: 'project not found in your org' }, { status: 404 })
    }

    return { type: 'session', orgId: org.id, projectId: bodyProjectId }
  }

  const oidcAuth = await resolveGithubOidcDeployAuth(request, { upsertProject: true })
  if (oidcAuth) return oidcAuth

  throw json({ error: 'invalid or missing authentication' }, { status: 401 })
}

export async function requireDeployAccess(request: Request, projectId: string): Promise<DeployAuth> {
  const apiKeyAuth = await validateApiKey(request.headers.get('authorization'))
  if (apiKeyAuth) {
    if (apiKeyAuth.projectId !== projectId) {
      throw json({ error: 'deployment does not belong to your project' }, { status: 403 })
    }
    return { type: 'api-key', orgId: apiKeyAuth.orgId, projectId: apiKeyAuth.projectId }
  }

  const session = await getSession(request)
  if (session) {
    const org = await ensureOrg(session.userId, session.user.name)
    const db = getDb()
    const proj = await db.query.project.findFirst({
      where: { projectId, orgId: org.id },
    })
    if (!proj) {
      throw json({ error: 'deployment does not belong to your project' }, { status: 403 })
    }
    return { type: 'session', orgId: org.id, projectId }
  }

  const oidcAuth = await resolveGithubOidcDeployAuth(request)
  if (oidcAuth) {
    if (oidcAuth.projectId !== projectId) {
      throw json({ error: 'deployment does not belong to your GitHub repository' }, { status: 403 })
    }
    return oidcAuth
  }

  throw json({ error: 'invalid or missing authentication' }, { status: 401 })
}

export async function resolveGithubOidcDeployAuth(
  request: Request,
  options: { upsertProject?: boolean } = {},
): Promise<Extract<DeployAuth, { type: 'github-oidc' }> | null> {
  const token = request.headers.get(GITHUB_OIDC_HEADER)
  if (!token) return null

  const audience = new URL(request.url).origin
  const oidcResult = await verifyGitHubOidc(token, audience)
  if (oidcResult instanceof Error) {
    throw json({ error: oidcResult.message }, { status: 401 })
  }

  const db = getDb()
  const githubAccount = await db.query.account.findFirst({
    where: {
      providerId: 'github',
      accountId: oidcResult.ownerIdStr,
    },
  })
  if (!githubAccount) {
    throw json(
      { error: 'no holocron account found for this GitHub user. sign in at holocron.so first.' },
      { status: 401 },
    )
  }

  const adminMembership = await db.query.orgMember.findFirst({
    where: { userId: githubAccount.userId, role: 'admin' },
    with: { org: true },
  })
  const orgId = adminMembership?.orgId ?? await (async () => {
    const userRow = await db.query.user.findFirst({ where: { id: githubAccount.userId } })
    const created = await ensureOrg(githubAccount.userId, userRow?.name ?? 'My Org')
    return created.id
  })()

  const branch = oidcResult.headRef
    || (oidcResult.ref?.startsWith('refs/heads/')
      ? oidcResult.ref.slice('refs/heads/'.length)
      : undefined)
    || 'main'
  const preview = !!oidcResult.headRef
  const projectId = options.upsertProject
    ? await upsertProjectForOidc({
      db,
      orgId,
      githubOwner: oidcResult.owner,
      githubRepo: oidcResult.repo,
      oidcBranch: oidcResult,
    })
    : await findProjectForOidc({
      db,
      orgId,
      githubOwner: oidcResult.owner,
      githubRepo: oidcResult.repo,
    })
  if (!projectId) {
    throw json({ error: 'no project found for this GitHub repository' }, { status: 403 })
  }

  return {
    type: 'github-oidc',
    orgId,
    projectId,
    githubOwner: oidcResult.owner,
    githubRepo: oidcResult.repo,
    branch,
    preview,
  }
}

async function findProjectForOidc({
  db,
  orgId,
  githubOwner,
  githubRepo,
}: {
  db: ReturnType<typeof getDb>
  orgId: string
  githubOwner: string
  githubRepo: string
}): Promise<string | null> {
  const existing = await db.query.project.findFirst({
    where: { orgId, githubOwner, githubRepo },
  })
  return existing?.projectId ?? null
}

async function verifyGitHubOidc(token: string, audience: string): Promise<OidcResult | Error> {
  try {
    const { payload } = await jose.jwtVerify(token, GITHUB_OIDC_JWKS, {
      issuer: 'https://token.actions.githubusercontent.com',
      audience,
    })

    const actorIdStr = String(payload.actor_id ?? '')
    if (!actorIdStr) return new Error('OIDC token missing actor_id claim')

    const repository = String(payload.repository ?? '')
    const [owner, repo] = repository.split('/')
    if (!owner || !repo) return new Error('OIDC token missing repository claim')

    const ref = String(payload.ref ?? '') || undefined
    const headRef = String(payload.head_ref ?? '') || undefined
    const baseRef = String(payload.base_ref ?? '') || undefined

    return { ownerIdStr: actorIdStr, owner, repo, ref, headRef, baseRef }
  } catch (err) {
    return new Error(`OIDC verification failed: ${err instanceof Error ? err.message : err}`)
  }
}

async function upsertProjectForOidc({
  db,
  orgId,
  githubOwner,
  githubRepo,
  oidcBranch,
}: {
  db: ReturnType<typeof getDb>,
  orgId: string
  githubOwner: string
  githubRepo: string
  oidcBranch: Pick<OidcResult, 'ref' | 'baseRef'>
}): Promise<string> {
  const existing = await db.query.project.findFirst({
    where: { orgId, githubOwner, githubRepo },
  })

  if (existing) {
    await db.update(schema.project)
      .set({ updatedAt: Date.now() })
      .where(orm.eq(schema.project.projectId, existing.projectId))
      .limit(1)
    return existing.projectId
  }

  const projectId = ulid()
  const defaultBranch = oidcBranch.baseRef
    || (oidcBranch.ref?.startsWith('refs/heads/')
      ? oidcBranch.ref.slice('refs/heads/'.length)
      : undefined)
    || 'main'
  const subdomain = buildProjectSubdomain({ githubOwner, githubRepo, projectId })

  await db.insert(schema.project).values({
    projectId,
    orgId,
    name: `${githubOwner}/${githubRepo}`,
    githubOwner,
    githubRepo,
    defaultBranch,
    subdomain,
  })

  return projectId
}
