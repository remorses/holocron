// Shared deploy authentication for API keys, BetterAuth sessions, and GitHub OIDC.
// GitHub Actions deployments stay keyless: the verified OIDC token identifies
// the repository, branch, preview state, Holocron user, org, and project.

import { env } from 'cloudflare:workers'
import * as jose from 'jose'
import * as orm from 'drizzle-orm'
import { json } from 'spiceflow'
import { ulid } from 'ulid'
import * as schema from 'db/schema'
import type { ApiKeyScope } from 'db/schema'
import { ensureOrg, getDb, getSession, validateApiKey } from './db.ts'

function githubOrgAccessUrl() {
  return `https://github.com/settings/connections/applications/${env.GITHUB_CLIENT_ID}`
}

function orgScopedKeyForbidden() {
  return json(
    {
      error: 'Org-scoped API keys cannot deploy or run Maintain.',
      hint: 'Create a project-scoped key and set HOLOCRON_KEY to that key.',
      command: 'npx -y "@holocron.so/cli" keys create --name production --project <projectId>',
    },
    { status: 403 },
  )
}

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

/** Labels that must never be claimed as custom project subdomains. */
export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'app',
  'cdn',
  'static',
  'admin',
  'dashboard',
  'preview',
  'cname',
  'mail',
  'status',
  'docs',
  'holocron',
  'site',
  'site-preview',
  'assets',
  'auth',
  'login',
  'oauth',
  'device',
  'billing',
  'support',
  'help',
  'blog',
  'www-site',
])

/** Validate and normalize a custom project subdomain slug.
 *  Returns the sanitized label or throws a spiceflow json Response. */
export function validateCustomSubdomain(raw: string): string {
  const sanitized = sanitizeForDns(raw)
  if (sanitized.length < 3 || sanitized.length > 48) {
    throw json(
      { error: 'subdomain must be 3–48 characters after sanitization (a-z, 0-9, hyphens)' },
      { status: 400 },
    )
  }
  if (RESERVED_SUBDOMAINS.has(sanitized)) {
    throw json({ error: `subdomain "${sanitized}" is reserved` }, { status: 400 })
  }
  // Must start with a letter or digit (sanitize already strips leading hyphens)
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(sanitized)) {
    throw json({ error: 'subdomain must start and end with a letter or digit' }, { status: 400 })
  }
  return sanitized
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

/** Prefer a stored custom subdomain; only derive from github/projectId when unset.
 *  Finalize must use this so custom slugs are not clobbered on every deploy. */
export function resolveProjectSubdomain(project: {
  subdomain?: string | null
  githubOwner?: string | null
  githubRepo?: string | null
  projectId: string
}): string {
  if (project.subdomain) return project.subdomain
  return buildProjectSubdomain(project)
}

type OidcResult = {
  ownerIdStr: string
  owner: string
  repo: string
  actor?: string
  ref?: string
  headRef?: string
  baseRef?: string
}

export type DeployAuth =
  | { type: 'api-key'; orgId: string; projectId: string; userId?: string; scope: ApiKeyScope }
  | { type: 'session'; orgId: string; projectId: string; userId: string }
  | {
      type: 'github-oidc'
      orgId: string
      projectId: string
      githubOwner: string
      githubRepo: string
      branch: string
      preview: boolean
      githubActor?: string
      userId?: string
    }

export async function resolveCreateDeployAuth(request: Request, bodyProjectId?: string): Promise<DeployAuth> {
  const apiKeyAuth = await validateApiKey(request.headers.get('authorization'))
  if (apiKeyAuth) {
    // Org keys are control-plane only (create projects / mint project keys).
    // Deploys always use a project-scoped key so blast radius stays per site.
    if (apiKeyAuth.scope === 'org') throw orgScopedKeyForbidden()
    return {
      type: 'api-key',
      orgId: apiKeyAuth.orgId,
      projectId: apiKeyAuth.projectId!,
      scope: 'project',
    }
  }

  const session = await getSession(request)
  if (session) {
    const org = await ensureOrg(session.userId, session.user.name)
    if (!bodyProjectId) {
      throw json({
        error: 'Missing project id for session auth.',
        hint: 'Pass --project <projectId>. Run `holocron whoami` to list project IDs.',
        command: 'npx -y "@holocron.so/cli" whoami',
      }, { status: 400 })
    }

    const db = getDb()
    const proj = await db.query.project.findFirst({
      where: { projectId: bodyProjectId, orgId: org.id },
    })
    if (!proj) {
      throw json({
        error: 'No project with that id in your organization.',
        hint: 'Run `holocron whoami` and pass a project id you own.',
        command: 'npx -y "@holocron.so/cli" whoami',
      }, { status: 404 })
    }

    return { type: 'session', orgId: org.id, projectId: bodyProjectId, userId: session.userId }
  }

  const oidcAuth = await resolveGithubOidcDeployAuth(request, { upsertProject: true })
  if (oidcAuth) return oidcAuth

  throw json({
    error: 'Not authenticated.',
    hint: 'Set HOLOCRON_KEY, run `npx -y "@holocron.so/cli" login`, or use GitHub Actions with permissions: id-token: write.',
  }, { status: 401 })
}

export async function requireDeployAccess(request: Request, projectId: string): Promise<DeployAuth> {
  const apiKeyAuth = await validateApiKey(request.headers.get('authorization'))
  if (apiKeyAuth) {
    if (apiKeyAuth.scope === 'org') throw orgScopedKeyForbidden()
    if (apiKeyAuth.projectId !== projectId) {
      throw json({
        error: 'This API key belongs to a different project.',
        hint: 'Use the project-scoped HOLOCRON_KEY for this site, or pass --project with a key from `holocron whoami`.',
        command: 'npx -y "@holocron.so/cli" whoami',
      }, { status: 403 })
    }
    return {
      type: 'api-key',
      orgId: apiKeyAuth.orgId,
      projectId: apiKeyAuth.projectId!,
      scope: 'project',
    }
  }

  const session = await getSession(request)
  if (session) {
    const org = await ensureOrg(session.userId, session.user.name)
    const db = getDb()
    const proj = await db.query.project.findFirst({
      where: { projectId, orgId: org.id },
    })
    if (!proj) {
      throw json({
        error: 'No project with that id in your organization.',
        hint: 'Run `holocron whoami` and pass a project id you own.',
        command: 'npx -y "@holocron.so/cli" whoami',
      }, { status: 403 })
    }
    return { type: 'session', orgId: org.id, projectId, userId: session.userId }
  }

  const oidcAuth = await resolveGithubOidcDeployAuth(request)
  if (oidcAuth) {
    if (oidcAuth.projectId !== projectId) {
      throw json({
        error: 'This GitHub repository is linked to a different Holocron project.',
        hint: 'Run Maintain from the repository that matches this project, or deploy once from this repo with permissions: id-token: write.',
      }, { status: 403 })
    }
    return oidcAuth
  }

  throw json({
    error: 'Not authenticated.',
    hint: 'Set HOLOCRON_KEY, run `npx -y "@holocron.so/cli" login`, or use GitHub Actions with permissions: id-token: write.',
  }, { status: 401 })
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
    throw json({
      error: 'No Holocron account for this GitHub user.',
      hint: 'Sign in at https://holocron.so with the same GitHub account that runs this workflow, then retry.',
    }, { status: 401 })
  }

  // For org repos, verify the deploying user is an admin of the GitHub org.
  // Personal repos (owner == actor) skip this check. The membership endpoint
  // returns 404 for non-org owners too, so no separate org-type check needed.
  if (!oidcResult.actor) {
    throw json({
      error: 'GitHub OIDC token is missing the actor claim.',
      hint: 'Add `permissions: { id-token: write }` to the GitHub Actions job.',
    }, { status: 401 })
  }
  if (oidcResult.owner.toLowerCase() !== oidcResult.actor.toLowerCase()) {
    await requireGitHubOrgAdmin({
      accessToken: githubAccount.accessToken,
      org: oidcResult.owner,
      username: oidcResult.actor,
    })
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
    throw json({
      error: `No Holocron project is linked to GitHub repository ${oidcResult.owner}/${oidcResult.repo}.`,
      hint: 'GitHub repos link on the first OIDC deploy or maintain run from that repo. Sign in at https://holocron.so with this GitHub account, subscribe the project to Pro, then rerun with permissions: id-token: write.',
    }, { status: 403 })
  }

  return {
    type: 'github-oidc',
    orgId,
    projectId,
    githubOwner: oidcResult.owner,
    githubRepo: oidcResult.repo,
    branch,
    preview,
    githubActor: oidcResult.actor,
    userId: githubAccount.userId,
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

    const actor = String(payload.actor ?? '') || undefined
    const ref = String(payload.ref ?? '') || undefined
    const headRef = String(payload.head_ref ?? '') || undefined
    const baseRef = String(payload.base_ref ?? '') || undefined

    return { ownerIdStr: actorIdStr, owner, repo, actor, ref, headRef, baseRef }
  } catch (err) {
    return new Error(`OIDC verification failed: ${err instanceof Error ? err.message : err}`)
  }
}

export const TEMPLATE_DEFAULT_SITE_NAME = 'My Docs'

/** Convert a GitHub repo slug like "my-awesome-docs" into "My Awesome Docs". */
function humanizeRepoName(repo: string): string {
  return repo
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
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
    const updates: Record<string, unknown> = { updatedAt: Date.now() }
    // Auto-rename projects still using the template default "My Docs"
    // to a human-readable version of the GitHub repo name.
    if (existing.name === TEMPLATE_DEFAULT_SITE_NAME) {
      updates.name = humanizeRepoName(githubRepo)
    }
    await db.update(schema.project)
      .set(updates)
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
    name: humanizeRepoName(githubRepo),
    githubOwner,
    githubRepo,
    defaultBranch,
    subdomain,
  })

  return projectId
}

// ── GitHub org membership check ─────────────────────────────────────

/** Verify the GitHub user is an admin of the given GitHub org.
 *  Uses the user's stored OAuth access token (requires read:org scope).
 *  The membership endpoint returns 404 for non-org owners too, so this
 *  doubles as a safe no-op for personal repos owned by someone else.
 *  Throws a JSON error if the user is not an admin or the token lacks scope. */
async function requireGitHubOrgAdmin({
  accessToken,
  org,
  username,
}: {
  accessToken: string | null
  org: string
  username: string
}): Promise<void> {
  if (!accessToken) {
    throw json({
      error: `Cannot verify GitHub org membership for ${org}.`,
      hint: `Open ${githubOrgAccessUrl()} and grant access for ${org}. Or open https://holocron.so/dashboard, go to project Settings, and click Grant org access.`,
    }, { status: 403 })
  }

  let res: Response
  try {
    res = await fetch(`https://api.github.com/orgs/${encodeURIComponent(org)}/memberships/${encodeURIComponent(username)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'holocron-deploy',
      },
    })
  } catch {
    throw json({
      error: `GitHub API request failed while checking org membership for ${org}.`,
      hint: 'Retry the workflow. If this keeps failing, grant org access from Holocron project Settings.',
    }, { status: 502 })
  }

  if (res.status === 401 || res.status === 403) {
    throw json({
      error: `Cannot verify GitHub org membership for ${org}.`,
      hint: `Open ${githubOrgAccessUrl()} and grant access for ${org}. Or open https://holocron.so/dashboard, go to project Settings, and click Grant org access.`,
    }, { status: 403 })
  }

  if (res.status === 404) {
    throw json({
      error: `GitHub user ${username} is not a member of ${org}.`,
      hint: `Add ${username} to the ${org} GitHub organization, or run this workflow from a personal repository.`,
    }, { status: 403 })
  }

  if (!res.ok) {
    throw json({
      error: `GitHub API returned ${res.status} while checking org membership for ${org}.`,
      hint: 'Retry the workflow. If this keeps failing, grant org access from Holocron project Settings.',
    }, { status: 502 })
  }

  const data = await res.json() as { role?: string; state?: string }
  if (data.role !== 'admin') {
    throw json({
      error: `GitHub user ${username} is not an admin of ${org}. Only org admins can deploy or run Maintain.`,
      hint: `Ask an admin of ${org} to run this workflow, or grant ${username} admin access on GitHub.`,
    }, { status: 403 })
  }
}
