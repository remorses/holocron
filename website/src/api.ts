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
  requireOrgMember,
  generateApiKey,
  hashApiKey,
} from './db.ts'
import { gatewayApp } from './gateway.ts'

// ── Shared schemas (derived from Drizzle tables) ────────────────────────

const ErrorResponse = z.object({ error: z.string() })

const OrgResponse = createSelectSchema(schema.org).pick({ id: true, name: true })

const ApiKeyResponse = createSelectSchema(schema.apiKey).pick({
  id: true,
  name: true,
  prefix: true,
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

  // ── Orgs ────────────────────────────────────────────────────────────

  .route({
    method: 'POST',
    path: '/api/v0/orgs/ensure-default',
    detail: {
      summary: 'Ensure default org',
      description:
        "Returns the current user's org, creating one if it doesn't exist yet. Idempotent.",
      tags: ['Orgs'],
    },
    response: {
      200: OrgResponse,
    },
    async handler({ request }) {
      const session = await requireSession(request)
      const db = getDb()

      const existing = await db.query.orgMember.findFirst({
        where: { userId: session.userId },
        with: { org: true },
      })
      if (existing?.org) {
        return { id: existing.org.id, name: existing.org.name }
      }

      const orgId = ulid()
      await db.batch([
        db.insert(schema.org).values({ id: orgId, name: session.user.name }),
        db.insert(schema.orgMember).values({ orgId, userId: session.userId, role: 'admin' }),
      ])
      return { id: orgId, name: session.user.name }
    },
  })

  // ── API Keys ────────────────────────────────────────────────────────

  .route({
    method: 'POST',
    path: '/api/v0/orgs/:orgId/keys',
    params: z.object({ orgId: z.string().describe('Org ULID.') }),
    request: z.object({
      name: z.string().min(1),
      projectId: z.string().optional().describe('Optional project ULID to scope the key to.'),
    }),
    detail: {
      summary: 'Create API key',
      description:
        'Creates a new `holo_xxx` API key for the org. Optionally scoped to a project. The full key is returned only in this response; it is never stored in plain text.',
      tags: ['API Keys'],
    },
    response: {
      200: ApiKeyCreatedResponse,
    },
    async handler({ request, params }) {
      const session = await requireSession(request)
      await requireOrgMember(session.userId, params.orgId)

      const body = await request.json()

      // Validate project belongs to this org if scoped
      if (body.projectId) {
        const db = getDb()
        const proj = await db.query.project.findFirst({
          where: { projectId: body.projectId, orgId: params.orgId },
          columns: { projectId: true },
        })
        if (!proj) {
          throw json({ error: 'project not found in this org' }, { status: 404 })
        }
      }

      const { fullKey, prefix } = generateApiKey()
      const hash = await hashApiKey(fullKey)
      const id = ulid()

      const db = getDb()
      await db.insert(schema.apiKey).values({
        id,
        orgId: params.orgId,
        projectId: body.projectId ?? null,
        name: body.name,
        prefix,
        hash,
      })

      return { id, name: body.name, prefix, key: fullKey }
    },
  })

  .route({
    method: 'GET',
    path: '/api/v0/orgs/:orgId/keys',
    params: z.object({ orgId: z.string().describe('Org ULID.') }),
    detail: {
      summary: 'List API keys',
      description:
        'Lists all API keys for the org. Only the prefix is returned, not the full secret.',
      tags: ['API Keys'],
    },
    response: {
      200: z.object({
        keys: z.array(ApiKeyResponse),
      }),
    },
    async handler({ request, params }) {
      const session = await requireSession(request)
      await requireOrgMember(session.userId, params.orgId)

      const db = getDb()
      const keys = await db
        .select({
          id: schema.apiKey.id,
          name: schema.apiKey.name,
          prefix: schema.apiKey.prefix,
          createdAt: schema.apiKey.createdAt,
        })
        .from(schema.apiKey)
        .where(orm.eq(schema.apiKey.orgId, params.orgId))
        .orderBy(orm.desc(schema.apiKey.createdAt))

      return { keys }
    },
  })

  .route({
    method: 'DELETE',
    path: '/api/v0/orgs/:orgId/keys/:id',
    params: z.object({
      orgId: z.string(),
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
      await requireOrgMember(session.userId, params.orgId)

      const db = getDb()
      const deleted = await db
        .delete(schema.apiKey)
        .where(
          orm.and(
            orm.eq(schema.apiKey.id, params.id),
            orm.eq(schema.apiKey.orgId, params.orgId),
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
      200: z.object({ keyId: z.string(), orgId: z.string() }),
      401: ErrorResponse,
    },
    async handler({ request }) {
      const body = await request.json()
      const hash = await hashApiKey(body.key)
      const db = getDb()

      const found = await db.query.apiKey.findFirst({
        where: { hash },
        columns: { id: true, orgId: true },
      })

      if (!found) {
        return json({ error: 'invalid key' }, { status: 401 })
      }

      return { keyId: found.id, orgId: found.orgId }
    },
  })

  // ── Projects (session auth, under org) ───────────────────────────────

  // Called by: dashboard "New Project" button, @holocron.so/cli create after
  // device flow login, and the /deploy server action (via actions.tsx).
  // Creates a docs site project record tied to the user's org.
  .route({
    method: 'POST',
    path: '/api/v0/orgs/:orgId/projects',
    params: z.object({ orgId: z.string() }),
    request: z.object({
      name: z.string().min(1),
      githubOwner: z.string().optional(),
      githubRepo: z.string().optional(),
    }),
    detail: {
      summary: 'Create project',
      description: 'Creates a new project in the org.',
      tags: ['Projects'],
    },
    response: { 200: ProjectResponse },
    async handler({ request, params }) {
      const session = await requireSession(request)
      await requireOrgMember(session.userId, params.orgId)

      const body = await request.json()
      const db = getDb()
      const projectId = ulid()

      await db.insert(schema.project).values({
        projectId,
        orgId: params.orgId,
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

export type ApiApp = typeof apiApp
