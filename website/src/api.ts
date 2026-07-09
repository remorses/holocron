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
  apiKeyCanAccessProject,
  getDb,
  requireManagementAuth,
  ensureOrg,
  requireSession,
  getOrgsForUser,
  generateApiKey,
  hashApiKey,
  validateApiKey,
} from './db.ts'
import { gatewayApp } from './gateway.ts'
import { deployApp } from './deploy-api.ts'
import { domainApp } from './domain-api.ts'
import { resolveGithubOidcDeployAuth, validateCustomSubdomain } from './deploy-auth.ts'

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
  scope: true,
  createdAt: true,
})

const ApiKeyCreatedResponse = createSelectSchema(schema.apiKey)
  .pick({ id: true, name: true, prefix: true, scope: true, projectId: true })
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

async function requireAdminSessionForOrg(request: Request, targetOrgId?: string) {
  const session = await requireSession(request)
  const org = await ensureOrg(session.userId, session.user.name, targetOrgId)
  const db = getDb()
  const membership = await db.query.orgMember.findFirst({
    where: { userId: session.userId, orgId: org.id },
  })
  if (!membership || membership.role !== 'admin') {
    throw json({ error: 'only admins can manage API keys' }, { status: 403 })
  }

  return { db, orgId: org.id, session }
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

/** Assert a custom subdomain is free (unique). Throws 409 if taken. */
async function assertSubdomainAvailable(db: ReturnType<typeof getDb>, subdomain: string) {
  const existing = await db.query.project.findFirst({ where: { subdomain } })
  if (existing) {
    throw json({ error: `subdomain "${subdomain}" is already in use` }, { status: 409 })
  }
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
      scope: z.enum(['project', 'org']).optional().describe('project (default) or org. Org keys require a signed-in admin session.'),
      projectId: z.string().min(1).optional().describe('Required when scope is project. Ignored for org keys.'),
      orgId: z.string().min(1).optional().describe('Target org for scope=org when the caller belongs to multiple orgs. Defaults to the caller\'s default org.'),
    }),
    detail: {
      hide: true,
      summary: 'Create API key',
      description:
        'Creates a new `holo_xxx` API key. Project keys can be minted by a signed-in org admin or by an existing org-scoped key. Org keys can only be created by a signed-in org admin (pass orgId when the admin belongs to multiple orgs). The full key is returned only once.',
      tags: ['API Keys'],
    },
    response: {
      200: ApiKeyCreatedResponse,
      400: ErrorResponse,
      403: ErrorResponse,
    },
    async handler({ request }) {
      const body = await request.json()
      const scope = body.scope ?? 'project'
      const db = getDb()

      if (scope === 'org') {
        // Only signed-in admins can mint org keys (prevents org-key sprawl).
        // Pass orgId when the admin belongs to multiple orgs (e.g. personal + partner).
        const { orgId } = await requireAdminSessionForOrg(request, body.orgId)
        const { fullKey, prefix } = generateApiKey()
        const hash = await hashApiKey(fullKey)
        const id = ulid()
        await db.insert(schema.apiKey).values({
          id,
          orgId,
          projectId: null,
          scope: 'org',
          name: body.name,
          prefix,
          hash,
        })
        return { id, name: body.name, prefix, key: fullKey, scope: 'org' as const, projectId: null }
      }

      if (!body.projectId) {
        throw json({ error: 'projectId is required when scope is project' }, { status: 400 })
      }

      // Session admin OR org-scoped API key for the project's org.
      const auth = await requireManagementAuth(request)
      const project = await db.query.project.findFirst({ where: { projectId: body.projectId } })
      if (!project) throw json({ error: 'project not found' }, { status: 404 })

      if (auth.type === 'session') {
        const membership = await db.query.orgMember.findFirst({
          where: { userId: auth.userId, orgId: project.orgId },
        })
        if (!membership) throw json({ error: 'not a member of this organization' }, { status: 403 })
        if (membership.role !== 'admin') throw json({ error: 'only admins can manage API keys' }, { status: 403 })
      } else if (auth.scope !== 'org' || auth.orgId !== project.orgId) {
        // Project keys cannot mint sibling keys; only org keys (same org) can.
        throw json(
          { error: 'creating project keys requires a signed-in admin session or an org-scoped API key' },
          { status: 403 },
        )
      }

      const { fullKey, prefix } = generateApiKey()
      const hash = await hashApiKey(fullKey)
      const id = ulid()

      await db.insert(schema.apiKey).values({
        id,
        orgId: project.orgId,
        projectId: body.projectId,
        scope: 'project',
        name: body.name,
        prefix,
        hash,
      })

      return {
        id,
        name: body.name,
        prefix,
        key: fullKey,
        scope: 'project' as const,
        projectId: body.projectId,
      }
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
        keys: keys.map(({ id, name, prefix, projectId, scope, createdAt }) => ({
          id,
          name,
          prefix,
          projectId: projectId ?? null,
          scope,
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
      200: z.object({
        keyId: z.string(),
        orgId: z.string(),
        projectId: z.string().nullable(),
        scope: z.enum(['project', 'org']),
      }),
      401: ErrorResponse,
    },
    async handler({ request }) {
      const body = await request.json()
      // Reuse validateApiKey so defensive invariants (e.g. project scope without
      // projectId) match every other auth path.
      const found = await validateApiKey(`Bearer ${body.key}`)
      if (!found) {
        return json({ error: 'invalid key' }, { status: 401 })
      }

      return {
        keyId: found.keyId,
        orgId: found.orgId,
        projectId: found.projectId,
        scope: found.scope,
      }
    },
  })

  // ── Account info ─────────────────────────────────────────────────

  .route({
    method: 'GET',
    path: '/api/v0/me',
    detail: {
      summary: 'Get me',
      description:
        'For a signed-in session, returns the user, all orgs they belong to, and projects per org. For a project-scoped API key, returns only the key\'s org and its single project (no user identity). For an org-scoped API key, returns all projects in that org.',
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

      // API key: no user identity.
      if (auth.type === 'api-key') {
        const org = await db.query.org.findFirst({ where: { id: auth.orgId } })
        if (!org) return { user: null, orgs: [] }

        if (auth.scope === 'org') {
          const projects = await db.query.project.findMany({
            where: { orgId: auth.orgId },
            orderBy: { updatedAt: 'desc' },
          })
          return {
            user: null,
            orgs: [{ id: org.id, name: org.name, role: 'api-key', projects }],
          }
        }

        const proj = auth.projectId
          ? await db.query.project.findFirst({
              where: { projectId: auth.projectId, orgId: auth.orgId },
            })
          : null
        return {
          user: null,
          orgs: [{ id: org.id, name: org.name, role: 'api-key', projects: proj ? [proj] : [] }],
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
        'For a signed-in session, lists every project across all orgs the caller belongs to. For a project-scoped API key, lists only the key\'s own project. For an org-scoped API key, lists every project in that org.',
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

      // Project API key: only its own project. Org API key: all projects in org.
      if (auth.type === 'api-key') {
        const org = await db.query.org.findFirst({ where: { id: auth.orgId } })
        if (auth.scope === 'org') {
          const projects = await db.query.project.findMany({
            where: { orgId: auth.orgId },
            orderBy: { updatedAt: 'desc' },
          })
          return {
            projects: projects.map((p) => ({ ...p, orgName: org?.name || '' })),
          }
        }
        const proj = auth.projectId
          ? await db.query.project.findFirst({
              where: { projectId: auth.projectId, orgId: auth.orgId },
            })
          : null
        if (!proj) return { projects: [] }
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
  // the /deploy server action, and multi-tenant control planes (org API key).
  // Creates a docs site project record tied to the caller's org.
  .route({
    method: 'POST',
    path: '/api/v0/projects',
    request: z.object({
      name: z.string().min(1),
      orgId: z.string().min(1).optional().describe('Target org ID. Session only; org keys always use the key\'s org.'),
      subdomain: z.string().min(1).max(63).optional().describe('Custom internal subdomain slug (e.g. acme-docs → acme-docs-site.holocron.so). Immutable after first production deploy.'),
      source: z.string().min(1).max(64).optional().describe('Optional provenance label (e.g. notaku).'),
      externalId: z.string().min(1).max(200).optional().describe('Optional external system id; unique per org.'),
    }),
    detail: {
      hide: true,
      summary: 'Create project',
      description:
        'Creates a new project. Accepts a signed-in session or an org-scoped API key. Project-scoped API keys cannot create sibling projects. Optional subdomain, source, and externalId support multi-tenant control planes.',
      tags: ['Projects'],
    },
    response: {
      200: ProjectResponse,
      400: ErrorResponse,
      403: ErrorResponse,
      409: ErrorResponse,
    },
    async handler({ request }) {
      const auth = await requireManagementAuth(request)
      const body = await request.json()
      const db = getDb()

      let orgId: string
      if (auth.type === 'api-key') {
        if (auth.scope !== 'org') {
          throw json(
            { error: 'creating projects requires a signed-in session or an org-scoped API key' },
            { status: 403 },
          )
        }
        if (body.orgId && body.orgId !== auth.orgId) {
          throw json({ error: 'org API key cannot create projects in another org' }, { status: 403 })
        }
        orgId = auth.orgId
      } else {
        const org = await ensureOrg(auth.userId, auth.userName, body.orgId)
        orgId = org.id
      }

      const subdomain = body.subdomain ? validateCustomSubdomain(body.subdomain) : null
      if (subdomain) await assertSubdomainAvailable(db, subdomain)

      if (body.externalId) {
        const existingExternal = await db.query.project.findFirst({
          where: { orgId, externalId: body.externalId },
        })
        if (existingExternal) {
          throw json(
            { error: `externalId "${body.externalId}" is already in use in this org` },
            { status: 409 },
          )
        }
      }

      const projectId = ulid()

      // githubOwner/githubRepo are only set via OIDC (verified JWT claims).
      // Project creation never accepts unverified github metadata.
      try {
        const [created] = await db.insert(schema.project).values({
          projectId,
          orgId,
          name: body.name,
          subdomain,
          source: body.source ?? null,
          externalId: body.externalId ?? null,
        }).returning()
        return created!
      } catch (err) {
        // Unique constraint race on subdomain or externalId
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('UNIQUE') || message.includes('unique')) {
          throw json({ error: 'subdomain or externalId already in use' }, { status: 409 })
        }
        throw err
      }
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
      } else if (auth.type === 'api-key' && !apiKeyCanAccessProject(auth, projectId, project.orgId)) {
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
