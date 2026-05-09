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
  validateApiKey,
} from './db.ts'
import { gatewayApp } from './gateway.ts'

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
        columns: { projectId: true },
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
      const keys = await db
        .select({
          id: schema.apiKey.id,
          name: schema.apiKey.name,
          prefix: schema.apiKey.prefix,
          projectId: schema.apiKey.projectId,
          createdAt: schema.apiKey.createdAt,
        })
        .from(schema.apiKey)
        .where(orm.eq(schema.apiKey.orgId, org.id))
        .orderBy(orm.desc(schema.apiKey.createdAt))

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
        columns: { id: true, orgId: true, projectId: true },
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
      const projects = await db
        .select()
        .from(schema.project)
        .where(orm.eq(schema.project.orgId, org.id))
        .orderBy(orm.desc(schema.project.createdAt))

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
      githubOwner: z.string().optional(),
      githubRepo: z.string().optional(),
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

      await db.insert(schema.project).values({
        projectId,
        orgId: org.id,
        name: body.name,
        githubOwner: body.githubOwner ?? null,
        githubRepo: body.githubRepo ?? null,
      })

      const created = await db.query.project.findFirst({
        where: { projectId },
      })
      return created!
    },
  })

  // ── Deployment registration (API key auth, called at build time) ─────

  // Called by the holocron vite plugin during `vite build` when HOLOCRON_KEY
  // is set. The project is resolved from the key itself — no separate
  // HOLOCRON_PROJECT env var needed. Registers GitHub metadata on the project
  // record so the dashboard knows which repo this project deploys from.
  // Idempotent — safe to call on every build.
  .route({
    method: 'POST',
    path: '/api/v0/register-deployment',
    request: z.object({
      githubOwner: z.string().optional(),
      githubRepo: z.string().optional(),
    }),
    detail: {
      summary: 'Register deployment',
      description:
        'Updates the key\'s project with GitHub metadata. Authenticated via API key (Bearer holo_xxx). The project is resolved from the key. Called automatically by the Holocron Vite plugin at build time.',
      tags: ['Projects'],
    },
    response: {
      200: z.object({ ok: z.boolean() }),
      401: ErrorResponse,
    },
    async handler({ request }) {
      const auth = await validateApiKey(request.headers.get('authorization'))
      if (!auth) {
        return json({ error: 'invalid or missing API key' }, { status: 401 })
      }

      const body = await request.json()
      const updates: Record<string, unknown> = { updatedAt: Date.now() }
      if (body.githubOwner) updates.githubOwner = body.githubOwner
      if (body.githubRepo) updates.githubRepo = body.githubRepo

      const db = getDb()
      await db.update(schema.project)
        .set(updates)
        .where(orm.eq(schema.project.projectId, auth.projectId))

      return { ok: true }
    },
  })

export type ApiApp = typeof apiApp
