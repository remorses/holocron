// Domain management API routes: add, list, status, remove custom domains.
//
// Custom domains use Cloudflare SSL for SaaS. Users CNAME their domain to
// cname.holocron.so, Cloudflare terminates SSL and routes to the hosting worker.
// The hosting worker resolves "custom-domain:{hostname}" in KV to find the
// project subdomain, then serves the site via the normal site-info flow.
//
// Security: KV mapping is NOT written until the domain status is active in
// Cloudflare (hostname verified + SSL provisioned). This prevents front-running
// where someone registers a domain they don't own. The domain stays in "pending"
// in D1 until the user runs `domain status` which refreshes from Cloudflare and
// writes the KV mapping once active.
//
// All routes require a subscription (custom domains cost money per hostname).
// Auth: session or API key via requireManagementAuth.

import { json, Spiceflow } from 'spiceflow'
import { z } from 'zod'
import * as orm from 'drizzle-orm'
import * as schema from 'db/schema'
import { env } from 'cloudflare:workers'
import { getDb, requireManagementAuth } from './db.ts'
import { ACTIVE_SUBSCRIPTION_STATUSES } from './lib/billing-rules.ts'
import { canAddDomain } from './lib/billing-rules.ts'
import {
  createCustomHostname,
  deleteCustomHostname,
  getCustomHostname,
  refreshCustomHostname,
  CNAME_TARGET,
} from './lib/cloudflare.ts'

const BLOCKED_SUFFIXES = ['.holocron.so', '.holocron.live', '.holocronsites.com']

/** Validate and normalize a hostname. Returns the normalized hostname or throws. */
function validateHostname(raw: string): string {
  const hostname = raw.trim().toLowerCase().replace(/\.$/, '')

  if (hostname.includes('/') || hostname.includes(':') || hostname.includes(' ')) {
    throw json({ error: 'Enter a hostname, not a URL.' }, { status: 400 })
  }

  // Must be a valid domain: labels separated by dots, each 1-63 chars, a-z0-9 and hyphens
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/.test(hostname)) {
    throw json({ error: 'Invalid hostname format.' }, { status: 400 })
  }

  for (const suffix of BLOCKED_SUFFIXES) {
    if (hostname.endsWith(suffix) || hostname === suffix.slice(1)) {
      throw json({ error: `${suffix} hostnames cannot be registered as custom domains.` }, { status: 400 })
    }
  }

  return hostname
}

const DomainResponse = z.object({
  id: z.string(),
  hostname: z.string(),
  status: z.string(),
  sslStatus: z.string().nullable(),
  cnameTarget: z.string().describe('CNAME target for DNS configuration.'),
  createdAt: z.number(),
})

const ErrorResponse = z.object({ error: z.string() })

async function requireProjectAccess(request: Request, projectId: string) {
  const auth = await requireManagementAuth(request)
  const db = getDb()
  const project = await db.query.project.findFirst({ where: { projectId } })
  if (!project) throw json({ error: 'project not found' }, { status: 404 })

  if (auth.type === 'session') {
    const membership = await db.query.orgMember.findFirst({
      where: { userId: auth.userId, orgId: project.orgId },
    })
    if (!membership) throw json({ error: 'not a member of this organization' }, { status: 403 })
  } else if (auth.type === 'api-key' && auth.projectId !== projectId) {
    throw json({ error: 'API key is scoped to a different project' }, { status: 403 })
  }

  return { db, project }
}

/** Sync the KV mapping for a domain based on its Cloudflare status.
 *  KV is written only when BOTH hostname and SSL are active (ready for
 *  traffic). If the domain becomes non-active, the KV entry is deleted
 *  so the hosting worker stops routing traffic to it. */
async function syncDomainKv(opts: {
  hostname: string
  status: string
  sslStatus: string | null
  projectSubdomain: string | null
}) {
  const key = `custom-domain:${opts.hostname}`
  if (opts.status === 'active' && opts.sslStatus === 'active' && opts.projectSubdomain) {
    await env.SITES_KV.put(key, opts.projectSubdomain)
    return
  }
  // Domain is not fully active; ensure no stale KV entry exists
  await env.SITES_KV.delete(key)
}

export const domainApp = new Spiceflow()

  // ── Add a custom domain ─────────────────────────────────────────────
  .route({
    method: 'POST',
    path: '/api/v0/domains',
    request: z.object({
      projectId: z.string().min(1).describe('Project ULID.'),
      hostname: z.string().min(1).max(253).describe('Custom domain hostname (e.g. docs.mycompany.com).'),
    }),
    detail: {
      summary: 'Add custom domain',
      description: 'Register a custom domain for a deployed project. Requires a Pro subscription. The domain must be CNAMEd to cname.holocron.so for SSL provisioning.',
      tags: ['Domains'],
    },
    response: {
      200: DomainResponse,
      400: ErrorResponse,
      402: ErrorResponse,
      409: ErrorResponse,
    },
    async handler({ request }) {
      const body = await request.json()
      const hostname = validateHostname(body.hostname)
      const { db, project } = await requireProjectAccess(request, body.projectId)

      // Subscription gate
      const activeSubscription = await db.query.subscription.findFirst({
        where: { projectId: body.projectId, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES] } },
      })
      const decision = canAddDomain({ hasActiveSubscription: !!activeSubscription })
      if (!decision.allowed) {
        throw json({ error: decision.reason }, { status: 402 })
      }

      // Check if hostname is already taken in our DB
      const existing = await db.query.domain.findFirst({ where: { hostname } })
      if (existing) {
        throw json({ error: `Domain "${hostname}" is already in use.` }, { status: 409 })
      }

      // Check if hostname is already registered in Cloudflare
      const cfExisting = await getCustomHostname(hostname).catch(() => null)
      if (cfExisting?.id) {
        throw json({ error: `Domain "${hostname}" is already configured in Cloudflare.` }, { status: 409 })
      }

      // Insert DB row first (pending) so we have a record to clean up if
      // the Cloudflare API call fails. This avoids orphaned Cloudflare
      // hostnames with no local tracking.
      const { ulid } = await import('ulid')
      const domainId = ulid()
      const now = Date.now()
      await db.insert(schema.domain).values({
        id: domainId,
        projectId: body.projectId,
        hostname,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      })

      let cfResult
      try {
        cfResult = await createCustomHostname(hostname)
      } catch (err) {
        // Clean up the DB row we just created
        await db.delete(schema.domain).where(orm.eq(schema.domain.id, domainId)).limit(1)
        throw err
      }

      // Update DB with Cloudflare response. If this fails, clean up both
      // the Cloudflare hostname and the DB row to avoid orphaned resources.
      const cfStatus = cfResult.status || 'pending'
      const cfSslStatus = cfResult.ssl?.status || null
      try {
        await db.update(schema.domain)
          .set({
            cloudflareId: cfResult.id,
            status: cfStatus,
            sslStatus: cfSslStatus,
            updatedAt: Date.now(),
          })
          .where(orm.eq(schema.domain.id, domainId))
          .limit(1)
      } catch (err) {
        await deleteCustomHostname(cfResult.id).catch(() => {})
        await db.delete(schema.domain).where(orm.eq(schema.domain.id, domainId)).limit(1).catch(() => {})
        throw err
      }

      // Only write KV mapping if the domain is already fully active (unlikely
      // on first create, but possible if DNS was pre-configured). This prevents
      // front-running: an attacker can register a domain they don't own, but
      // until Cloudflare verifies DNS ownership + SSL, no traffic is routed.
      await syncDomainKv({
        hostname,
        status: cfStatus,
        sslStatus: cfSslStatus ?? null,
        projectSubdomain: project.subdomain ?? null,
      })

      return {
        id: domainId,
        hostname,
        status: cfStatus,
        sslStatus: cfSslStatus ?? null,
        cnameTarget: CNAME_TARGET,
        createdAt: now,
      }
    },
  })

  // ── List domains for a project ──────────────────────────────────────
  .route({
    method: 'GET',
    path: '/api/v0/domains/:projectId',
    params: z.object({
      projectId: z.string().describe('Project ULID.'),
    }),
    detail: {
      summary: 'List custom domains',
      description: 'List all custom domains for a project.',
      tags: ['Domains'],
    },
    response: {
      200: z.object({
        domains: z.array(DomainResponse),
      }),
    },
    async handler({ request, params }) {
      const { db } = await requireProjectAccess(request, params.projectId)
      const domains = await db.query.domain.findMany({
        where: { projectId: params.projectId },
        orderBy: { createdAt: 'desc' },
      })

      return {
        domains: domains.map((d) => ({
          id: d.id,
          hostname: d.hostname,
          status: d.status,
          sslStatus: d.sslStatus ?? null,
          cnameTarget: CNAME_TARGET,
          createdAt: d.createdAt,
        })),
      }
    },
  })

  // ── Check domain status ─────────────────────────────────────────────
  .route({
    method: 'GET',
    path: '/api/v0/domains/:projectId/:domainId/status',
    params: z.object({
      projectId: z.string().describe('Project ULID.'),
      domainId: z.string().describe('Domain ULID.'),
    }),
    detail: {
      summary: 'Check domain status',
      description: 'Fetch the latest status from Cloudflare and update the local record. When the domain becomes active, the KV mapping is written so the hosting worker starts serving traffic.',
      tags: ['Domains'],
    },
    response: {
      200: DomainResponse,
      404: ErrorResponse,
    },
    async handler({ request, params }) {
      const { db, project } = await requireProjectAccess(request, params.projectId)
      const domainRow = await db.query.domain.findFirst({
        where: { id: params.domainId, projectId: params.projectId },
      })
      if (!domainRow) {
        throw json({ error: 'domain not found' }, { status: 404 })
      }

      // Refresh status from Cloudflare
      let status = domainRow.status
      let sslStatus = domainRow.sslStatus
      if (domainRow.cloudflareId) {
        const cfResult = await refreshCustomHostname(domainRow.cloudflareId).catch(() => null)
        if (cfResult) {
          status = cfResult.status || status
          sslStatus = cfResult.ssl?.status || sslStatus
          await db.update(schema.domain)
            .set({ status, sslStatus, updatedAt: Date.now() })
            .where(orm.eq(schema.domain.id, domainRow.id))
            .limit(1)

          // Write or clear KV mapping based on current status.
          // Traffic starts being routed only when both hostname and SSL are active.
          await syncDomainKv({
            hostname: domainRow.hostname,
            status,
            sslStatus: sslStatus ?? null,
            projectSubdomain: project.subdomain ?? null,
          })
        }
      }

      return {
        id: domainRow.id,
        hostname: domainRow.hostname,
        status,
        sslStatus: sslStatus ?? null,
        cnameTarget: CNAME_TARGET,
        createdAt: domainRow.createdAt,
      }
    },
  })

  // ── Remove a custom domain ──────────────────────────────────────────
  .route({
    method: 'DELETE',
    path: '/api/v0/domains/:projectId/:domainId',
    params: z.object({
      projectId: z.string().describe('Project ULID.'),
      domainId: z.string().describe('Domain ULID.'),
    }),
    detail: {
      summary: 'Remove custom domain',
      description: 'Delete a custom domain from Cloudflare and the database.',
      tags: ['Domains'],
    },
    response: {
      200: z.object({ deleted: z.boolean() }),
      404: ErrorResponse,
    },
    async handler({ request, params }) {
      const { db } = await requireProjectAccess(request, params.projectId)
      const domainRow = await db.query.domain.findFirst({
        where: { id: params.domainId, projectId: params.projectId },
      })
      if (!domainRow) {
        throw json({ error: 'domain not found' }, { status: 404 })
      }

      // Delete from Cloudflare first. If this fails, don't delete from DB
      // so the user can retry. Swallowing errors here would orphan paid
      // Cloudflare hostnames with no way to clean them up.
      if (domainRow.cloudflareId) {
        await deleteCustomHostname(domainRow.cloudflareId)
      }

      // Delete KV mapping
      await env.SITES_KV.delete(`custom-domain:${domainRow.hostname}`)

      // Delete from D1
      await db.delete(schema.domain)
        .where(orm.eq(schema.domain.id, domainRow.id))
        .limit(1)

      return { deleted: true }
    },
  })

export type DomainApp = typeof domainApp
