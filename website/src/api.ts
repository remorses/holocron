// API routes for org and API key management under /api/v0.
// Mounted on the root app via .use(apiApp) in server.tsx.
//
// Key format: holo_<64 hex chars>. Only the SHA-256 hash is stored in D1.
// The full key is returned exactly once at creation time.
//
// Zod schemas on each route drive runtime validation, TypeScript types,
// AND the OpenAPI spec (via spiceflow/openapi). To regenerate the spec:
//   pnpm generate-openapi

import { json, Spiceflow } from 'spiceflow'
import { openapi } from 'spiceflow/openapi'
import { z } from 'zod'
import { createSelectSchema } from 'drizzle-orm/zod'
import * as orm from 'drizzle-orm'
import * as schema from 'db/schema'
import { ulid } from 'ulid'
import * as jose from 'jose'
import {
  getDb,
  requireSession,
  ensureOrg,
  generateApiKey,
  hashApiKey,
} from './db.ts'
import { gatewayApp } from './gateway.ts'
import { buildProjectSubdomain } from './deploy-api.ts'

// ── Shared schemas (derived from Drizzle tables) ────────────────────────

const ErrorResponse = z.object({ error: z.string() })

const ApiKeyResponse = createSelectSchema(schema.apiKey).pick({
  id: true,
  name: true,
  prefix: true,
  projectId: true,
  createdAt: true,
})

const ApiKeyCreatedResponse = createSelectSchema(schema.apiKey)
  .pick({ id: true, name: true, prefix: true })
  .extend({
    key: z.string().describe('Full `holo_xxx` key. Shown only once at creation.'),
  })

const ProjectResponse = createSelectSchema(schema.project)



// ── App ─────────────────────────────────────────────────────────────────

export const apiApp = new Spiceflow()
  .use(gatewayApp)
  .use(
    openapi({
      path: '/openapi.json',
      info: {
        title: 'Holocron API',
        version: '0.1.0',
        description:
          'Management API for Holocron organizations and API keys.',
      },
    }),
  )

  // ── API Keys ────────────────────────────────────────────────────────

  .route({
    method: 'POST',
    path: '/api/v0/keys',
    request: z.object({
      name: z.string().min(1),
      projectId: z.string().min(1).describe('Project ULID the key is scoped to.'),
    }),
    detail: {
      summary: 'Create API key',
      description:
        'Creates a new `holo_xxx` API key scoped to a project. The full key is returned only in this response; it is never stored in plain text.',
      tags: ['API Keys'],
    },
    response: {
      200: ApiKeyCreatedResponse,
    },
    async handler({ request }) {
      const session = await requireSession(request)
      const org = await ensureOrg(session.userId, session.user.name)

      const body = await request.json()

      // Validate project belongs to this org
      const db = getDb()
      const proj = await db.query.project.findFirst({
        where: { projectId: body.projectId, orgId: org.id },
      })
      if (!proj) {
        throw json({ error: 'project not found in this org' }, { status: 404 })
      }

      const { fullKey, prefix } = generateApiKey()
      const hash = await hashApiKey(fullKey)
      const id = ulid()

      await db.insert(schema.apiKey).values({
        id,
        orgId: org.id,
        projectId: body.projectId,
        name: body.name,
        prefix,
        hash,
        key: fullKey,
      })

      return { id, name: body.name, prefix, key: fullKey }
    },
  })

  .route({
    method: 'GET',
    path: '/api/v0/keys',
    detail: {
      summary: 'List API keys',
      description:
        'Lists all API keys for the caller\'s org. Only the prefix is returned, not the full secret.',
      tags: ['API Keys'],
    },
    response: {
      200: z.object({
        keys: z.array(ApiKeyResponse),
      }),
    },
    async handler({ request }) {
      const session = await requireSession(request)
      const org = await ensureOrg(session.userId, session.user.name)

      const db = getDb()
      const keys = await db.query.apiKey.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: 'desc' },
      })

      return { keys }
    },
  })

  .route({
    method: 'DELETE',
    path: '/api/v0/keys/:id',
    params: z.object({
      id: z.string().describe('Key ULID.'),
    }),
    detail: {
      summary: 'Delete API key',
      tags: ['API Keys'],
    },
    response: {
      200: z.object({ deleted: z.boolean() }),
      404: ErrorResponse,
    },
    async handler({ request, params }) {
      const session = await requireSession(request)
      const org = await ensureOrg(session.userId, session.user.name)

      const db = getDb()
      const deleted = await db
        .delete(schema.apiKey)
        .where(
          orm.and(
            orm.eq(schema.apiKey.id, params.id),
            orm.eq(schema.apiKey.orgId, org.id),
          ),
        )
        .returning({ id: schema.apiKey.id })

      if (deleted.length === 0) {
        return json({ error: 'key not found' }, { status: 404 })
      }

      return { deleted: true }
    },
  })

  // ── Key validation (used internally by the AI gateway) ──────────────

  .route({
    method: 'POST',
    path: '/api/v0/keys/validate',
    request: z.object({ key: z.string().min(1) }),
    detail: {
      summary: 'Validate API key',
      description:
        'Checks if a `holo_xxx` key is valid and returns the associated org. Used internally by the AI gateway.',
      tags: ['API Keys'],
    },
    response: {
      200: z.object({ keyId: z.string(), orgId: z.string(), projectId: z.string() }),
      401: ErrorResponse,
    },
    async handler({ request }) {
      const body = await request.json()
      const hash = await hashApiKey(body.key)
      const db = getDb()

      const found = await db.query.apiKey.findFirst({
        where: { hash },
      })

      if (!found) {
        return json({ error: 'invalid key' }, { status: 401 })
      }

      return { keyId: found.id, orgId: found.orgId, projectId: found.projectId }
    },
  })

  // ── Projects (session auth, under org) ───────────────────────────────

  // List all projects for the caller's org.
  .route({
    method: 'GET',
    path: '/api/v0/projects',
    detail: {
      summary: 'List projects',
      description: 'Lists all projects for the caller\'s org.',
      tags: ['Projects'],
    },
    response: { 200: z.object({ projects: z.array(ProjectResponse) }) },
    async handler({ request }) {
      const session = await requireSession(request)
      const org = await ensureOrg(session.userId, session.user.name)

      const db = getDb()
      const projects = await db.query.project.findMany({
        where: { orgId: org.id },
        orderBy: { createdAt: 'desc' },
      })

      return { projects }
    },
  })

  // Called by: @holocron.so/cli create after device flow login,
  // and the /deploy server action (via actions.tsx).
  // Creates a docs site project record tied to the caller's org (auto-created if needed).
  .route({
    method: 'POST',
    path: '/api/v0/projects',
    request: z.object({
      name: z.string().min(1),
    }),
    detail: {
      summary: 'Create project',
      description: 'Creates a new project in the caller\'s org (auto-created if needed).',
      tags: ['Projects'],
    },
    response: { 200: ProjectResponse },
    async handler({ request }) {
      const session = await requireSession(request)
      const org = await ensureOrg(session.userId, session.user.name)

      const body = await request.json()
      const db = getDb()
      const projectId = ulid()

      // githubOwner/githubRepo are only set via OIDC (verified JWT claims).
      // Project creation never accepts unverified github metadata.
      await db.insert(schema.project).values({
        projectId,
        orgId: org.id,
        name: body.name,
      })

      const created = await db.query.project.findFirst({
        where: { projectId },
      })
      return created!
    },
  })

  // ── Deployment registration (OIDC only, called at build time) ──

  // Called by the holocron vite plugin during `vite build` in GitHub Actions.
  // Auth: GitHub Actions OIDC → oidcToken in body. JWT is verified against
  // GitHub's JWKS. The actor's GitHub user ID is matched against the account
  // table (providerId=github) to find the holocron user, then their first
  // admin org is used to find-or-create the project.
  // GitHub owner/repo are derived from the verified JWT, never from the body.
  // Idempotent — safe to call on every build.
  .route({
    method: 'POST',
    path: '/api/v0/register-deployment',
    request: z.object({
      oidcToken: z.string().optional(),
    }),
    detail: {
      summary: 'Register deployment',
      description:
        'Registers a project via GitHub Actions OIDC. JWT is verified against GitHub JWKS; owner/repo are derived from the token claims. Called automatically by the Holocron Vite plugin at build time.',
      tags: ['Projects'],
    },
    response: {
      200: z.object({
        ok: z.boolean(),
        projectId: z.string().optional(),
        apiKey: z.string().optional().describe('Returned only for OIDC auth. Full holo_xxx key for the project.'),
        branch: z.string().optional().describe('Derived branch name from the OIDC JWT (head_ref for PRs, ref for pushes).'),
        preview: z.boolean().optional().describe('True when the OIDC token comes from a pull_request event.'),
      }),
      401: ErrorResponse,
    },
    async handler({ request }) {
      const body = await request.json()
      const db = getDb()

      // Only OIDC auth is supported. GitHub owner/repo are derived from the
      // verified JWT's `repository` claim, never from unverified body values.
      // API key auth was removed because it could only bump updatedAt (no
      // github metadata) and nothing in the vite plugin calls it anymore.
      if (body.oidcToken) {
        const audience = new URL(request.url).origin
        const oidcResult = await verifyGitHubOidc(body.oidcToken, audience)
        if (oidcResult instanceof Error) {
          return json({ error: oidcResult.message }, { status: 401 })
        }

        // Derive branch from OIDC context:
        //   PR events: headRef is the source branch (e.g. "fix-typo")
        //   Push events: ref is "refs/heads/main" → strip prefix
        //   Tags/other: fall back to "main"
        const isPullRequest = !!oidcResult.headRef
        const branch = oidcResult.headRef
          || (oidcResult.ref?.startsWith('refs/heads/')
            ? oidcResult.ref.slice('refs/heads/'.length)
            : undefined)
          || 'main'

        // Find holocron user by GitHub numeric user ID
        const githubAccount = await db.query.account.findFirst({
          where: {
            providerId: 'github',
            accountId: oidcResult.ownerIdStr,
          },
        })
        if (!githubAccount) {
          return json(
            { error: 'no holocron account found for this GitHub user. sign in at holocron.so first.' },
            { status: 401 },
          )
        }

        // Find first org where user is admin
        let orgId: string
        const adminMembership = await db.query.orgMember.findFirst({
          where: { userId: githubAccount.userId, role: 'admin' },
          with: { org: true },
        })
        if (adminMembership?.orgId) {
          orgId = adminMembership.orgId
        } else {
          // Create an org for the user (same as login flow)
          const userRow = await db.query.user.findFirst({
            where: { id: githubAccount.userId },
          })
          const created = await ensureOrg(githubAccount.userId, userRow?.name ?? 'My Org')
          orgId = created.id
        }

        const result = await upsertProjectForOidc(db, orgId, oidcResult.owner, oidcResult.repo, {
          ref: oidcResult.ref,
          headRef: oidcResult.headRef,
          baseRef: oidcResult.baseRef,
        })
        return { ...result, branch, preview: isPullRequest || undefined }
      }

      return json({ error: 'invalid or missing authentication' }, { status: 401 })
    },
  })

// ── GitHub Actions OIDC verification ──────────────────────────────────────

const GITHUB_OIDC_JWKS = jose.createRemoteJWKSet(
  new URL('https://token.actions.githubusercontent.com/.well-known/jwks'),
)

type OidcResult = {
  ownerIdStr: string
  owner: string
  repo: string
  /** Full git ref, e.g. "refs/heads/main" or "refs/pull/123/merge" */
  ref?: string
  /** PR source branch, e.g. "fix-typo" (only set for pull_request events) */
  headRef?: string
  /** PR target branch, e.g. "main" (only set for pull_request events) */
  baseRef?: string
}

// PR safety: we intentionally do NOT reject tokens from pull_request workflows.
// The actor_id claim maps to the PR author's GitHub user ID, so the project is
// created/found under the PR author's own holocron org, not the repo owner's.
// A PR from an external contributor without a holocron account gets a 401.
// A PR from a maintainer who IS the project owner deploys to the real project,
// but that's expected: maintainers already have push access to the repo.
// Fork PRs can't get OIDC tokens unless the base repo workflow explicitly
// grants id-token:write, which is the repo owner's responsibility.
async function verifyGitHubOidc(token: string, audience: string): Promise<OidcResult | Error> {
  try {
    const { payload } = await jose.jwtVerify(token, GITHUB_OIDC_JWKS, {
      issuer: 'https://token.actions.githubusercontent.com',
      audience,
    })

    // Use actor_id (the user who triggered the workflow) instead of
    // repository_owner_id which would be the org ID for org-owned repos.
    // actor_id always maps to the GitHub user's personal account ID, which
    // matches what better-auth stores in account.accountId during OAuth.
    const actorIdStr = String(payload.actor_id ?? '')
    if (!actorIdStr) {
      return new Error('OIDC token missing actor_id claim')
    }

    // Derive repo metadata from the verified token, not from the request body,
    // so a valid token from one repo can't claim to be a different repo.
    const repository = String(payload.repository ?? '')
    const [owner, repo] = repository.split('/')
    if (!owner || !repo) {
      return new Error('OIDC token missing repository claim')
    }

    // Branch context from OIDC claims:
    //   push events:  ref="refs/heads/main", head_ref="", base_ref=""
    //   PR events:    ref="refs/pull/123/merge", head_ref="fix-typo", base_ref="main"
    const ref = String(payload.ref ?? '') || undefined
    const headRef = String(payload.head_ref ?? '') || undefined
    const baseRef = String(payload.base_ref ?? '') || undefined

    return { ownerIdStr: actorIdStr, owner, repo, ref, headRef, baseRef }
  } catch (err) {
    return new Error(`OIDC verification failed: ${err instanceof Error ? err.message : err}`)
  }
}

// Find or create a project for the given org + GitHub repo, then find or
// create an API key for it. Returns the full holo_xxx key so the vite plugin
// can set HOLOCRON_KEY for the rest of the build.
// D1 is single-writer so true races are unlikely.
async function upsertProjectForOidc(
  db: ReturnType<typeof getDb>,
  orgId: string,
  githubOwner: string,
  githubRepo: string,
  oidcBranch?: { ref?: string; headRef?: string; baseRef?: string },
) {
  // Try to find existing project with this repo in this org
  let projectId: string
  const existing = await db.query.project.findFirst({
    where: {
      orgId,
      githubOwner,
      githubRepo,
    },
  })

  if (existing) {
    projectId = existing.projectId
    await db.update(schema.project)
      .set({ updatedAt: Date.now() })
      .where(orm.eq(schema.project.projectId, projectId))
      .limit(1)
  } else {
    // Derive default branch from OIDC context:
    //   PR events: baseRef is the target (default) branch
    //   Push events: ref is the branch being pushed to (likely the default on first CI setup)
    let defaultBranch = 'main'
    if (oidcBranch?.baseRef) {
      defaultBranch = oidcBranch.baseRef
    } else if (oidcBranch?.ref?.startsWith('refs/heads/')) {
      defaultBranch = oidcBranch.ref.slice('refs/heads/'.length)
    }

    // Set subdomain eagerly so the URL is ready before the first deploy finalizes.
    // buildProjectSubdomain returns "{repo}-{owner}" for OIDC projects.
    projectId = ulid()
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
  }

  // Find existing API key for this project, or create one
  const existingKey = await db.query.apiKey.findFirst({
    where: { projectId },
  })

  if (existingKey?.key) {
    return { ok: true, projectId, apiKey: existingKey.key }
  }

  // Create a new API key for this project
  const { fullKey, prefix } = generateApiKey()
  const keyHash = await hashApiKey(fullKey)
  await db.insert(schema.apiKey).values({
    id: ulid(),
    orgId,
    projectId,
    name: 'oidc-deploy',
    prefix,
    hash: keyHash,
    key: fullKey,
  })

  return { ok: true, projectId, apiKey: fullKey }
}

export type ApiApp = typeof apiApp
