// API routes for org and API key management under /api/v0.
// Mounted on the root app via .use(apiApp) in server.tsx.
//
// Key format: holo_<64 hex chars>. Only the SHA-256 hash is stored in D1.
// The full key is returned exactly once at creation time.

import { json, Spiceflow } from 'spiceflow'
import { z } from 'zod'
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

const createKeyRequestSchema = z.object({
  name: z.string().min(1),
})

export const apiApp = new Spiceflow()

  // ── Orgs ────────────────────────────────────────────────────────────

  .route({
    method: 'POST',
    path: '/api/v0/orgs/ensure-default',
    async handler({ request }) {
      const session = await requireSession(request)
      const db = getDb()

      // Find existing org membership
      const existing = await db.query.orgMember.findFirst({
        where: { userId: session.userId },
        with: { org: true },
      })
      if (existing?.org) {
        return { id: existing.org.id, name: existing.org.name }
      }

      // Create default org
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
    request: createKeyRequestSchema,
    async handler({ request, params }) {
      const session = await requireSession(request)
      await requireOrgMember(session.userId, params.orgId)

      const body = await request.json()
      const { fullKey, prefix } = generateApiKey()
      const hash = await hashApiKey(fullKey)
      const id = ulid()

      const db = getDb()
      await db.insert(schema.apiKey).values({
        id,
        orgId: params.orgId,
        name: body.name,
        prefix,
        hash,
      })

      return { id, name: body.name, prefix, key: fullKey }
    },
  })

  .get('/api/v0/orgs/:orgId/keys', async ({ request, params }) => {
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
  })

  .route({
    method: 'DELETE',
    path: '/api/v0/orgs/:orgId/keys/:id',
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

  // ── Key validation (used by the AI gateway) ─────────────────────────

  .route({
    method: 'POST',
    path: '/api/v0/keys/validate',
    request: z.object({ key: z.string().min(1) }),
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
