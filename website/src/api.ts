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
  requireSession,
  getOrgsForUser,
  generateApiKey,
  hashApiKey,
} from './db.ts'
import { gatewayApp } from './gateway.ts'
import { deployApp } from './deploy-api.ts'
import { domainApp } from './domain-api.ts'
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

async function requireAdminSessionForProject(request: Request, projectId: string) {
  const session = await requireSession(request)
  const db = getDb()
  const project = await db.query.project.findFirst({ where: { projectId } })
  if (!project) throw json({ error: 'project not found' }, { status: 404 })

  const membership = await db.query.orgMember.findFirst({
    where: { userId: session.userId, orgId: project.orgId },
  })
  if (!membership) throw json({ error: 'not a member of this organization' }, { status: 403 })
  if (membership.role !== 'admin') throw json({ error: 'only admins can manage API keys' }, { status: 403 })

  return { db, orgId: project.orgId }
}

async function requireAdminSessionForOrg(request: Request) {
  const session = await requireSession(request)
  const org = await ensureOrg(session.userId, session.user.name)
  const db = getDb()
  const membership = await db.query.orgMember.findFirst({
    where: { userId: session.userId, orgId: org.id },
  })
  if (!membership || membership.role !== 'admin') {
    throw json({ error: 'only admins can manage API keys' }, { status: 403 })
  }

  return { db, orgId: org.id }
}

async function requireAdminSessionForKey(request: Request, keyId: string) {
  const session = await requireSession(request)
  const db = getDb()
  const key = await db.query.apiKey.findFirst({ where: { id: keyId } })
  if (!key) throw json({ error: 'key not found' }, { status: 404 })

  const membership = await db.query.orgMember.findFirst({
    where: { userId: session.userId, orgId: key.orgId },
  })
  if (!membership || membership.role !== 'admin') {
    throw json({ error: 'only admins can manage API keys' }, { status: 403 })
  }

  return { db, key }
}



// ── App ─────────────────────────────────────────────────────────────────

export const apiApp = new Spiceflow()
  .use(gatewayApp)
  .use(deployApp)
  .use(domainApp)
  .use(
    openapi({
      path: '/openapi.json',
      info: {
        title: 'Holocron API',
        version: '0.1.0',
        description:
          'API for deploying docs sites, managing organizations, and API keys.',
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
      hide: true,
      summary: 'Create API key',
      description:
        'Creates a new `holo_xxx` API key scoped to a project. Requires a signed-in org admin. The full key is returned only in this response; it is never stored in plain text.',
      tags: ['API Keys'],
    },
    response: {
      200: ApiKeyCreatedResponse,
    },
    async handler({ request }) {
      const body = await request.json()
      const { db, orgId } = await requireAdminSessionForProject(request, body.projectId)

      const { fullKey, prefix } = generateApiKey()
      const hash = await hashApiKey(fullKey)
      const id = ulid()

      await db.insert(schema.apiKey).values({
        id,
        orgId,
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
      hide: true,
      summary: 'List API keys',
      description:
        'Lists API keys for the signed-in admin\'s org. Only the prefix is returned, not the full secret.',
      tags: ['API Keys'],
    },
    response: {
      200: z.object({
        keys: z.array(ApiKeyResponse),
      }),
    },
    async handler({ request }) {
      const { db, orgId } = await requireAdminSessionForOrg(request)
      const keys = await db.query.apiKey.findMany({
        where: { orgId },
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
      hide: true,
      summary: 'Delete API key',
      description: 'Deletes an API key. Requires a signed-in org admin.',
      tags: ['API Keys'],
    },
    response: {
      200: z.object({ deleted: z.boolean() }),
      404: ErrorResponse,
    },
    async handler({ request, params }) {
      const { db, key } = await requireAdminSessionForKey(request, params.id)
      const deleted = await db
        .delete(schema.apiKey)
        .where(orm.eq(schema.apiKey.id, key.id))
        .limit(1)
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
      hide: true,
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
      summary: 'Get me',
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
      hide: true,
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

  // ── Subscriptions ────────────────────────────────────────────────────

  .route({
    method: 'GET',
    path: '/api/v0/subscriptions/:projectId',
    params: z.object({
      projectId: z.string().describe('Project ULID.'),
    }),
    detail: {
      hide: true,
      summary: 'Get project subscription',
      description: 'Returns the active subscription for a project, or null if none.',
      tags: ['Subscriptions'],
    },
    response: {
      200: z.object({
        subscription: z.object({
          subscriptionId: z.string(),
          status: z.string(),
          interval: z.enum(['month', 'year']).nullable(),
          currentPeriodEnd: epochMsField().nullable(),
          cancelAtPeriodEnd: z.boolean(),
        }).nullable(),
      }),
    },
    async handler({ request, params }) {
      const auth = await requireManagementAuth(request)
      const db = getDb()
      const { projectId } = params

      // Verify the caller has access to this project's org
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

      const { getProjectSubscription } = await import('./db.ts')
      const subscription = await getProjectSubscription(projectId)
      return { subscription }
    },
  })

  .route({
    method: 'POST',
    path: '/api/v0/subscriptions/checkout',
    request: z.object({
      projectId: z.string().min(1).describe('Project ULID to subscribe.'),
      interval: z.enum(['monthly', 'yearly']).describe('Billing interval.'),
    }),
    detail: {
      hide: true,
      summary: 'Create checkout session',
      description: 'Creates a Stripe Checkout session for subscribing a project. Returns the checkout URL. If the project already has an active subscription, returns a billing portal URL instead.',
      tags: ['Subscriptions'],
    },
    response: {
      200: z.object({
        url: z.string().describe('Stripe Checkout or Billing Portal URL.'),
        alreadySubscribed: z.boolean().describe('True when redirecting to portal instead of checkout.'),
      }),
      403: ErrorResponse,
      404: ErrorResponse,
    },
    async handler({ request }) {
      const session = await requireSession(request)
      const body = await request.json()
      const db = getDb()

      const project = await db.query.project.findFirst({ where: { projectId: body.projectId } })
      if (!project) throw json({ error: 'project not found' }, { status: 404 })

      const membership = await db.query.orgMember.findFirst({
        where: { userId: session.userId, orgId: project.orgId },
      })
      if (!membership) throw json({ error: 'not a member of this organization' }, { status: 403 })
      if (membership.role !== 'admin') throw json({ error: 'only admins can manage billing' }, { status: 403 })

      const { getOrCreateStripeCustomer, getProPriceId, getStripe } = await import('./lib/stripe.ts')
      const { getProjectSubscription, getBaseUrl } = await import('./db.ts')
      const customerId = await getOrCreateStripeCustomer({ orgId: project.orgId, email: session.user.email })
      if (customerId instanceof Error) throw customerId

      const stripe = getStripe()
      const returnUrl = new URL(`/dashboard/projects/${body.projectId}/billing`, getBaseUrl()).toString()

      // If already subscribed, return billing portal instead
      const existing = await getProjectSubscription(body.projectId)
      if (existing) {
        const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
        return { url: portal.url, alreadySubscribed: true }
      }

      const billingInterval: 'monthly' | 'yearly' = body.interval === 'monthly' ? 'monthly' : 'yearly'
      const priceId = await getProPriceId(billingInterval)
      if (priceId instanceof Error) throw priceId

      const checkout = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: returnUrl,
        cancel_url: returnUrl,
        allow_promotion_codes: true,
        client_reference_id: body.projectId,
        metadata: { orgId: project.orgId, projectId: body.projectId },
        subscription_data: { metadata: { orgId: project.orgId, projectId: body.projectId } },
      })
      if (!checkout.url) throw new Error('Checkout session has no URL')

      return { url: checkout.url, alreadySubscribed: false }
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
      hide: true,
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
