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
import {
  getDb,
  requireManagementAuth,
  ensureOrg,
  getOrgsForUser,
  generateApiKey,
  hashApiKey,
} from './db.ts'
import { gatewayApp } from './gateway.ts'
import { resolveGithubOidcDeployAuth } from './deploy-auth.ts'

// ── Shared schemas (derived from Drizzle tables) ────────────────────────
//
// `epochMs` is a Drizzle customType whose TS data type is `number`, but
// drizzle-zod can't introspect custom column types and falls back to
// `z.unknown()`. We override every timestamp column with `z.number()` so the
// generated response types (and the typed fetch client) expose real epoch-ms
// numbers instead of `unknown`.
const epochMsField = () => z.number().describe('Unix epoch milliseconds.')

const ErrorResponse = z.object({ error: z.string() })

const ApiKeyResponse = createSelectSchema(schema.apiKey, {
  createdAt: epochMsField,
}).pick({
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

const ProjectResponse = createSelectSchema(schema.project, {
  createdAt: epochMsField,
  updatedAt: epochMsField,
})



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
      const auth = await requireManagementAuth(request)

      const body = await request.json()

      // A project-scoped API key may only create keys for its own project.
      if (auth.type === 'api-key' && body.projectId !== auth.projectId) {
        throw json({ error: 'API key cannot create keys for another project' }, { status: 403 })
      }

      // Validate project belongs to this org
      const db = getDb()
      const proj = await db.query.project.findFirst({
        where: { projectId: body.projectId, orgId: auth.orgId },
      })
      if (!proj) {
        throw json({ error: 'project not found in this org' }, { status: 404 })
      }

      const { fullKey, prefix } = generateApiKey()
      const hash = await hashApiKey(fullKey)
      const id = ulid()

      await db.insert(schema.apiKey).values({
        id,
        orgId: auth.orgId,
        projectId: body.projectId,
        name: body.name,
        prefix,
        hash,
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
        'Lists API keys for the caller. A signed-in session lists every key in the org; a project-scoped API key lists only keys for its own project. Only the prefix is returned, not the full secret.',
      tags: ['API Keys'],
    },
    response: {
      200: z.object({
        keys: z.array(ApiKeyResponse),
      }),
    },
    async handler({ request }) {
      const auth = await requireManagementAuth(request)

      const db = getDb()
      const keys = await db.query.apiKey.findMany({
        // API keys are scoped to their own project; sessions see the whole org.
        where: auth.type === 'api-key'
          ? { orgId: auth.orgId, projectId: auth.projectId }
          : { orgId: auth.orgId },
        orderBy: { createdAt: 'desc' },
      })

      return {
        keys: keys.map(({ id, name, prefix, projectId, createdAt }) => ({
          id,
          name,
          prefix,
          projectId,
          createdAt,
        })),
      }
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
      const auth = await requireManagementAuth(request)

      const db = getDb()
      // API keys may only delete keys within their own project; sessions
      // may delete any key in the org.
      const conditions = [
        orm.eq(schema.apiKey.id, params.id),
        orm.eq(schema.apiKey.orgId, auth.orgId),
      ]
      if (auth.type === 'api-key') {
        conditions.push(orm.eq(schema.apiKey.projectId, auth.projectId))
      }
      const deleted = await db
        .delete(schema.apiKey)
        .where(orm.and(...conditions))
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

  // ── Account info ─────────────────────────────────────────────────

  .route({
    method: 'GET',
    path: '/api/v0/me',
    detail: {
      summary: 'Current caller info',
      description:
        'For a signed-in session, returns the user, all orgs they belong to, and projects per org. For a project-scoped API key, returns only the key\'s org and its single project (no user identity).',
      tags: ['Account'],
    },
    response: {
      200: z.object({
        user: z.object({
          name: z.string(),
          email: z.string(),
          image: z.string().nullable(),
        }).nullable().describe('Null when authenticated with an API key.'),
        orgs: z.array(z.object({
          id: z.string(),
          name: z.string(),
          role: z.string(),
          projects: z.array(ProjectResponse),
        })),
      }),
    },
    async handler({ request }) {
      const auth = await requireManagementAuth(request)
      const db = getDb()

      // API key: no user identity. Return only the key's org + its one project.
      if (auth.type === 'api-key') {
        const org = await db.query.org.findFirst({ where: { id: auth.orgId } })
        const proj = await db.query.project.findFirst({
          where: { projectId: auth.projectId, orgId: auth.orgId },
        })
        return {
          user: null,
          orgs: org
            ? [{ id: org.id, name: org.name, role: 'api-key', projects: proj ? [proj] : [] }]
            : [],
        }
      }

      const orgs = await getOrgsForUser(auth.userId)

      let orgsWithProjects: Array<typeof orgs[number] & { projects: (typeof schema.project.$inferSelect)[] }>
      if (orgs.length === 0) {
        orgsWithProjects = []
      } else {
        const orgIds = orgs.map((o) => o.id)
        const allProjects = await db
          .select()
          .from(schema.project)
          .where(orm.inArray(schema.project.orgId, orgIds))
          .orderBy(orm.desc(schema.project.updatedAt))
        const projectsByOrg = new Map<string, typeof allProjects>()
        for (const p of allProjects) {
          const list = projectsByOrg.get(p.orgId) || []
          list.push(p)
          projectsByOrg.set(p.orgId, list)
        }
        orgsWithProjects = orgs.map((org) => ({
          ...org,
          projects: projectsByOrg.get(org.id) || [],
        }))
      }

      const user = await db.query.user.findFirst({ where: { id: auth.userId } })
      return {
        user: user
          ? { name: user.name, email: user.email, image: user.image ?? null }
          : null,
        orgs: orgsWithProjects,
      }
    },
  })

  // ── Projects (session auth, under org) ───────────────────────────────

  // List all projects across all orgs the user belongs to.
  .route({
    method: 'GET',
    path: '/api/v0/projects',
    detail: {
      summary: 'List projects',
      description:
        'For a signed-in session, lists every project across all orgs the caller belongs to. For a project-scoped API key, lists only the key\'s own project.',
      tags: ['Projects'],
    },
    response: {
      200: z.object({
        projects: z.array(
          ProjectResponse.extend({
            orgId: z.string(),
            orgName: z.string(),
          }),
        ),
      }),
    },
    async handler({ request }) {
      const auth = await requireManagementAuth(request)
      const db = getDb()

      // API key: only its own project.
      if (auth.type === 'api-key') {
        const proj = await db.query.project.findFirst({
          where: { projectId: auth.projectId, orgId: auth.orgId },
        })
        if (!proj) return { projects: [] }
        const org = await db.query.org.findFirst({ where: { id: auth.orgId } })
        return { projects: [{ ...proj, orgName: org?.name || '' }] }
      }

      const orgs = await getOrgsForUser(auth.userId)

      // If user has no orgs yet, create their default one
      if (orgs.length === 0) {
        await ensureOrg(auth.userId, auth.userName)
        return { projects: [] }
      }

      const orgIds = orgs.map((o) => o.id)
      const allProjects = await db
        .select()
        .from(schema.project)
        .where(orm.inArray(schema.project.orgId, orgIds))
        .orderBy(orm.desc(schema.project.updatedAt))

      const orgNameById = new Map(orgs.map((o) => [o.id, o.name]))
      return {
        projects: allProjects.map((p) => ({ ...p, orgName: orgNameById.get(p.orgId) || '' })),
      }
    },
  })

  // Called by: @holocron.so/cli create after device flow login,
  // and the /deploy server action (via actions.tsx).
  // Creates a docs site project record tied to the caller's org (auto-created if needed).
  // When orgId is provided, creates the project in that specific org (user must be a member).
  .route({
    method: 'POST',
    path: '/api/v0/projects',
    request: z.object({
      name: z.string().min(1),
      orgId: z.string().min(1).optional().describe('Target org ID. If omitted, uses the default org (auto-created if needed).'),
    }),
    detail: {
      summary: 'Create project',
      description: 'Creates a new project in the caller\'s org (auto-created if needed). Pass orgId to target a specific org. Requires a signed-in session; project-scoped API keys cannot create sibling projects.',
      tags: ['Projects'],
    },
    response: { 200: ProjectResponse, 403: ErrorResponse },
    async handler({ request }) {
      const auth = await requireManagementAuth(request)
      // A project-scoped API key must not create sibling projects in the org.
      if (auth.type === 'api-key') {
        throw json({ error: 'creating projects requires a signed-in session, not an API key' }, { status: 403 })
      }
      const body = await request.json()
      const org = await ensureOrg(auth.userId, auth.userName, body.orgId)

      const db = getDb()
      const projectId = ulid()

      // githubOwner/githubRepo are only set via OIDC (verified JWT claims).
      // Project creation never accepts unverified github metadata.
      const [created] = await db.insert(schema.project).values({
        projectId,
        orgId: org.id,
        name: body.name,
      }).returning()

      return created!
    },
  })

  // ── Deployment registration (OIDC only, called at build time) ──

  // Called by the holocron vite plugin during `vite build` in GitHub Actions.
  // Auth: GitHub Actions OIDC in X-Holocron-GitHub-OIDC-Token. JWT is verified against
  // GitHub's JWKS. The actor's GitHub user ID is matched against the account
  // table (providerId=github) to find the holocron user, then their first
  // admin org is used to find-or-create the project.
  // GitHub owner/repo are derived from the verified JWT, never from the body.
  // Idempotent — safe to call on every build.
  .route({
    method: 'POST',
    path: '/api/v0/register-deployment',
    request: z.object({}).optional(),
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
        branch: z.string().optional().describe('Derived branch name from the OIDC JWT (head_ref for PRs, ref for pushes).'),
        preview: z.boolean().optional().describe('True when the OIDC token comes from a pull_request event.'),
      }),
      401: ErrorResponse,
    },
    async handler({ request }) {
      const auth = await resolveGithubOidcDeployAuth(request, { upsertProject: true })
      if (!auth) return json({ error: 'invalid or missing GitHub OIDC authentication' }, { status: 401 })
      return { ok: true, projectId: auth.projectId, branch: auth.branch, preview: auth.preview || undefined }
    },
  })

export type ApiApp = typeof apiApp
