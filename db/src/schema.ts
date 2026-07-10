// Schema for the Holocron D1 database.
// Contains BetterAuth core tables for auth (GitHub social login, device flow),
// the org/member hierarchy, project tracking for deployed docs sites, and
// API keys for authenticating vite plugin ↔ holocron.so gateway calls.

import { defineRelations } from 'drizzle-orm'
import * as s from 'drizzle-orm/sqlite-core'
import { ulid } from 'ulid'

// Integer column that stores epoch milliseconds as a plain number.
// Accepts Date objects in toDriver so BetterAuth's internal Date params
// don't crash D1's .bind() which only accepts string | number | null | ArrayBuffer.
export const epochMs = s.customType<{ data: number; driverParam: number }>({
  dataType() { return 'integer' },
  toDriver(value: unknown): number {
    if (value instanceof Date) return value.getTime()
    return value as number
  },
  fromDriver(value: unknown): number { return value as number },
})

// ── BetterAuth core tables ──────────────────────────────────────────

export const user = s.sqliteTable('user', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  name: s.text('name').notNull(),
  email: s.text('email').notNull().unique(),
  emailVerified: s.integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: s.text('image'),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
})

export const session = s.sqliteTable('session', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  userId: s.text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  token: s.text('token').notNull().unique(),
  expiresAt: epochMs('expires_at').notNull(),
  ipAddress: s.text('ip_address'),
  userAgent: s.text('user_agent'),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('session_user_id_idx').on(table.userId),
])

export const account = s.sqliteTable('account', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  userId: s.text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accountId: s.text('account_id').notNull(),
  providerId: s.text('provider_id').notNull(),
  accessToken: s.text('access_token'),
  refreshToken: s.text('refresh_token'),
  accessTokenExpiresAt: epochMs('access_token_expires_at'),
  refreshTokenExpiresAt: epochMs('refresh_token_expires_at'),
  scope: s.text('scope'),
  idToken: s.text('id_token'),
  password: s.text('password'),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('account_user_id_idx').on(table.userId),
])

export const verification = s.sqliteTable('verification', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  identifier: s.text('identifier').notNull(),
  value: s.text('value').notNull(),
  expiresAt: epochMs('expires_at').notNull(),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
})

// ── Org tables ──────────────────────────────────────────────────────

export const org = s.sqliteTable('org', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  name: s.text('name').notNull(),
  /** Stripe customer id — one customer per org, set once on first checkout.
   *  Single source of truth; reused for every checkout/portal call so we never
   *  create duplicate Stripe customers. */
  stripeCustomerId: s.text('stripe_customer_id'),
  /** free = normal billing gates. partner = unlimited deploys + domains without
   *  a per-project Stripe subscription (multi-tenant control planes like Notaku).
   *  Only set via ops/scripts — no public API mutates this. */
  plan: s.text('plan', { enum: ['free', 'partner'] }).notNull().default('free'),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
})

/** free | partner — derived from org.plan enum, not a hand-written union. */
export type OrgPlan = typeof org.$inferSelect.plan

export const orgMember = s.sqliteTable('org_member', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  orgId: s.text('org_id').notNull().references(() => org.id, { onDelete: 'cascade' }),
  userId: s.text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  role: s.text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('org_member_org_id_idx').on(table.orgId),
  s.index('org_member_user_id_idx').on(table.userId),
  s.uniqueIndex('org_member_org_id_user_id_unique').on(table.orgId, table.userId),
])

// ── Org invitations (link-based invite flow) ────────────────────────

export const orgInvitation = s.sqliteTable('org_invitation', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  orgId: s.text('org_id').notNull().references(() => org.id, { onDelete: 'cascade' }),
  role: s.text('role', { enum: ['admin', 'member'] }).notNull().default('member'),
  createdBy: s.text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: epochMs('expires_at').notNull(),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('org_invitation_org_id_idx').on(table.orgId),
])

// ── Projects (one docs site = one project, tied to an org) ──────────

export const project = s.sqliteTable('project', {
  projectId: s.text('project_id').primaryKey().notNull().$defaultFn(() => ulid()),
  orgId: s.text('org_id').notNull().references(() => org.id, { onDelete: 'cascade' }),
  name: s.text('name').notNull(),
  subdomain: s.text('subdomain').unique(),
  /** Also synced to KV: when this changes, the finalize route writes the new deployment's
   *  data to KV at "site-info:{subdomain}" so the hosting worker resolves the latest version.
   *  D1 is the source of truth; KV is the read-optimized replica for request-time lookups. */
  currentDeploymentId: s.text('current_deployment_id'),
  /** Default branch for production deploys (e.g. "main", "master"). Deploys to this
   *  branch update project.currentDeploymentId; other branches create preview deployments. */
  defaultBranch: s.text('default_branch').default('main'),
  githubOwner: s.text('github_owner'),
  githubRepo: s.text('github_repo'),
  /** Optional provenance label (e.g. "notaku", "cli", "github"). Free string for support. */
  source: s.text('source'),
  /** Optional external system id (e.g. Notaku site id). Unique per org when set. */
  externalId: s.text('external_id'),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('project_org_id_idx').on(table.orgId),
  s.uniqueIndex('project_org_id_external_id_unique').on(table.orgId, table.externalId),
])



// ── Deployments (version history per project, stored in KV) ─────────

export const deployment = s.sqliteTable('deployment', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  projectId: s.text('project_id').notNull().references(() => project.projectId, { onDelete: 'cascade' }),
  /** Unique ULID generated at deployment creation time. Used as a KV namespace to isolate
   *  files between deploys: all uploaded files are stored at "site:{projectId}/v:{version}/{filePath}".
   *  Not a sequential counter or semver; each deploy simply gets a fresh ULID.
   *  Also synced to KV inside "site-info:{subdomain}" → { projectId, version, files[] }
   *  so the hosting worker can build file paths without querying D1. */
  version: s.text('version').notNull(),
  /** Also synced to KV: only the "active" deployment has a live "site-info:{subdomain}"
   *  entry. Superseded deployments' KV entries are overwritten (same subdomain key)
   *  when the new deployment for that branch is finalized. */
  status: s.text('status', { enum: ['uploading', 'active', 'superseded'] }).notNull().default('uploading'),
  /** Branch name this deployment was built from (e.g. "main", "fix-typo"). */
  branch: s.text('branch').default('main'),
  /** Explicitly marked as a preview deployment (e.g. from a PR). When true, finalize
   *  NEVER updates project.currentDeploymentId, regardless of branch name. This prevents
   *  a PR branch named "main" from accidentally overwriting production. */
  preview: s.integer('preview', { mode: 'boolean' }).default(false),
  /** Full DNS subdomain label for this deployment (e.g. "my-docs-remorses" for production,
   *  "fix-typo-my-docs-remorses" for preview). Set during finalize. Used as the KV key
   *  suffix: "site-info:{subdomain}". Must stay in sync with KV; the finalize route
   *  writes both D1 and KV atomically. */
  subdomain: s.text('subdomain'),
  /** JSON array of declared file paths; validated during finalize to ensure all were uploaded.
   *  Also synced to KV inside "site-info:{subdomain}" → { files[] } so the hosting worker
   *  knows which worker/ modules to load without querying D1. */
  files: s.text('files'),
  /** User who triggered the deployment via session or API key auth. Null for OIDC-only deploys
   *  where the user might not be in our DB (rare — we require sign-in before OIDC works). */
  triggeredByUserId: s.text('triggered_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  /** GitHub username from OIDC JWT `actor` claim. Used to build avatar URL
   *  (`https://github.com/{actor}.png`) in the deployment history UI.
   *  Also set for session auth if we know the user's GitHub username from their account. */
  githubActor: s.text('github_actor'),
  /** Base path prefix for subpath deploys (e.g. "/docs/"). When set, the Vite build
   *  uses this as `base` so all routes and assets are prefixed. The hosting worker
   *  strips this prefix before looking up assets in the manifest. Null for root deploys. */
  basePath: s.text('base_path'),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('deployment_project_id_idx').on(table.projectId),
  s.index('deployment_subdomain_idx').on(table.subdomain),
])

// ── Subscriptions (one paid subscription unlocks one project/site) ──

export const subscription = s.sqliteTable('subscription', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  /** Stripe subscription id (sub_...). Unique → idempotent upsert key for webhooks. */
  subscriptionId: s.text('subscription_id').notNull().unique(),
  /** Billing identity. The Stripe customer lives on the org, not the project. */
  orgId: s.text('org_id').notNull().references(() => org.id, { onDelete: 'cascade' }),
  /** The SITE this subscription unlocks. Gating (deploy limits, AI notice) keys off this. */
  projectId: s.text('project_id').notNull().references(() => project.projectId, { onDelete: 'cascade' }),
  /** Stripe customer id, denormalized from org for convenience. */
  customerId: s.text('customer_id'),
  /** Stripe price id (price_...). */
  priceId: s.text('price_id').notNull(),
  /** Stripe product id (prod_...). */
  productId: s.text('product_id'),
  /** active | trialing | past_due | canceled | incomplete | ... (Stripe status). */
  status: s.text('status').notNull(),
  /** Billing interval: "month" | "year". */
  interval: s.text('interval', { enum: ['month', 'year'] }),
  currentPeriodEnd: epochMs('current_period_end'),
  cancelAtPeriodEnd: s.integer('cancel_at_period_end', { mode: 'boolean' }).default(false),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('subscription_org_id_idx').on(table.orgId),
  s.index('subscription_project_id_idx').on(table.projectId),
])

// ── API keys ────────────────────────────────────────────────────────
// scope=project: pinned to one project (deploy, domains, chat for that site).
// scope=org: control-plane only — create projects, mint project keys, list.
//   Cannot deploy, manage domains, or use AI chat. projectId is null.

export const apiKey = s.sqliteTable('api_key', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  orgId: s.text('org_id').notNull().references(() => org.id, { onDelete: 'cascade' }),
  /** Null when scope is org. Required when scope is project. */
  projectId: s.text('project_id').references(() => project.projectId, { onDelete: 'cascade' }),
  /** project = single-site key; org = multi-tenant control plane key. */
  scope: s.text('scope', { enum: ['project', 'org'] }).notNull().default('project'),
  name: s.text('name').notNull(),
  prefix: s.text('prefix').notNull(),
  hash: s.text('hash').notNull().unique(),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('api_key_org_id_idx').on(table.orgId),
  s.index('api_key_project_id_idx').on(table.projectId),
])

/** project | org — derived from apiKey.scope enum. */
export type ApiKeyScope = typeof apiKey.$inferSelect.scope

// ── Google Search Console connection (one per project) ──────────────
// Stores OAuth tokens obtained via an external OAuth proxy (e.g. Framer's
// plugin-oauth worker). The oauthAppId tracks which proxy was used so we
// can swap to our own GCP app later without breaking existing connections.

export const gscConnection = s.sqliteTable('gsc_connection', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  projectId: s.text('project_id').notNull().references(() => project.projectId, { onDelete: 'cascade' }).unique(),
  /** Identifies which OAuth proxy issued the tokens (e.g. "framer-gsc-plugin").
   *  TODO: Replace with our own GCP OAuth app id once approved. */
  oauthAppId: s.text('oauth_app_id').notNull(),
  /** Google account email, populated after first successful API call. */
  googleEmail: s.text('google_email'),
  /** The GSC property URL the user selected (e.g. "sc-domain:example.com"
   *  or "https://example.com/"). Null until user picks one. */
  siteUrl: s.text('site_url'),
  accessToken: s.text('access_token').notNull(),
  refreshToken: s.text('refresh_token'),
  /** When the access_token expires (epoch ms). */
  expiresAt: epochMs('expires_at'),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('gsc_connection_project_id_idx').on(table.projectId),
])

// ── Custom domains (Cloudflare SSL for SaaS) ────────────────────────
// Each domain is a custom hostname registered via the Cloudflare API.
// Users CNAME their domain to cname.holocron.so; Cloudflare terminates
// SSL and routes to the hosting worker. The hosting worker looks up
// "custom-domain:{hostname}" in KV to resolve the project subdomain.
// Only projects with an active subscription can add custom domains.

export const domain = s.sqliteTable('domain', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  projectId: s.text('project_id').notNull().references(() => project.projectId, { onDelete: 'cascade' }),
  /** The custom hostname, e.g. "docs.mycompany.com". Unique across all projects. */
  hostname: s.text('hostname').notNull().unique(),
  /** Cloudflare custom hostname ID (from POST /custom_hostnames response).
   *  Needed for PATCH/DELETE calls to manage the hostname lifecycle. */
  cloudflareId: s.text('cloudflare_id'),
  /** Hostname status from Cloudflare: pending, active, moved, deleted, etc. */
  status: s.text('status').notNull().default('pending'),
  /** SSL certificate status: initializing, pending_validation, active, etc. */
  sslStatus: s.text('ssl_status'),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('domain_project_id_idx').on(table.projectId),
])

// ── Device flow (BetterAuth device authorization plugin) ────────────

export const deviceCode = s.sqliteTable('device_code', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  deviceCode: s.text('device_code').notNull().unique(),
  userCode: s.text('user_code').notNull().unique(),
  userId: s.text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: epochMs('expires_at').notNull(),
  status: s.text('status', { enum: ['pending', 'approved', 'denied', 'expired'] }).notNull().default('pending'),
  lastPolledAt: epochMs('last_polled_at'),
  pollingInterval: s.integer('polling_interval', { mode: 'number' }),
  clientId: s.text('client_id'),
  scope: s.text('scope'),
}, (table) => [
  s.index('device_code_user_id_idx').on(table.userId),
])

// ── Relations (v2 API) ──────────────────────────────────────────────

export const relations = defineRelations(
  { user, session, account, verification, org, orgMember, orgInvitation, apiKey, deviceCode, project, deployment, subscription, gscConnection, domain },
  (r) => ({
    user: {
      sessions: r.many.session(),
      accounts: r.many.account(),
      orgs: r.many.org({
        from: r.user.id.through(r.orgMember.userId),
        to: r.org.id.through(r.orgMember.orgId),
      }),
    },
    session: {
      user: r.one.user({ from: r.session.userId, to: r.user.id }),
    },
    account: {
      user: r.one.user({ from: r.account.userId, to: r.user.id }),
    },
    verification: {},
    org: {
      members: r.many.orgMember(),
      invitations: r.many.orgInvitation(),
      keys: r.many.apiKey(),
      projects: r.many.project(),
      subscriptions: r.many.subscription(),
      users: r.many.user({
        from: r.org.id.through(r.orgMember.orgId),
        to: r.user.id.through(r.orgMember.userId),
      }),
    },
    orgMember: {
      org: r.one.org({ from: r.orgMember.orgId, to: r.org.id }),
      user: r.one.user({ from: r.orgMember.userId, to: r.user.id }),
    },
    orgInvitation: {
      org: r.one.org({ from: r.orgInvitation.orgId, to: r.org.id }),
      creator: r.one.user({ from: r.orgInvitation.createdBy, to: r.user.id }),
    },
    apiKey: {
      org: r.one.org({ from: r.apiKey.orgId, to: r.org.id }),
      project: r.one.project({ from: r.apiKey.projectId, to: r.project.projectId }),
    },
    deviceCode: {
      user: r.one.user({ from: r.deviceCode.userId, to: r.user.id }),
    },
    project: {
      org: r.one.org({ from: r.project.orgId, to: r.org.id }),
      keys: r.many.apiKey(),
      deployments: r.many.deployment(),
      subscriptions: r.many.subscription(),
      gscConnection: r.one.gscConnection({ from: r.project.projectId, to: r.gscConnection.projectId }),
      domains: r.many.domain(),
    },
    gscConnection: {
      project: r.one.project({ from: r.gscConnection.projectId, to: r.project.projectId }),
    },
    domain: {
      project: r.one.project({ from: r.domain.projectId, to: r.project.projectId }),
    },
    deployment: {
      project: r.one.project({ from: r.deployment.projectId, to: r.project.projectId }),
      triggeredByUser: r.one.user({ from: r.deployment.triggeredByUserId, to: r.user.id }),
    },
    subscription: {
      org: r.one.org({ from: r.subscription.orgId, to: r.org.id }),
      project: r.one.project({ from: r.subscription.projectId, to: r.project.projectId }),
    },
  }),
)
