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
  requireSession,
  ensureOrg,
  generateApiKey,
  hashApiKey,
} from './db.ts'
import { gatewayApp } from './gateway.ts'
import { resolveGithubOidcDeployAuth } from './deploy-auth.ts'

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
        orderBy: { updatedAt: 'desc' },
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
