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
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
})

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
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
  updatedAt: epochMs('updated_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('project_org_id_idx').on(table.orgId),
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
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('deployment_project_id_idx').on(table.projectId),
  s.index('deployment_subdomain_idx').on(table.subdomain),
])

// ── API keys (one key per project, key alone identifies the project) ─

export const apiKey = s.sqliteTable('api_key', {
  id: s.text('id').primaryKey().notNull().$defaultFn(() => ulid()),
  orgId: s.text('org_id').notNull().references(() => org.id, { onDelete: 'cascade' }),
  projectId: s.text('project_id').notNull().references(() => project.projectId, { onDelete: 'cascade' }),
  name: s.text('name').notNull(),
  prefix: s.text('prefix').notNull(),
  hash: s.text('hash').notNull().unique(),
  createdAt: epochMs('created_at').notNull().$defaultFn(() => Date.now()),
}, (table) => [
  s.index('api_key_org_id_idx').on(table.orgId),
  s.index('api_key_project_id_idx').on(table.projectId),
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
  { user, session, account, verification, org, orgMember, apiKey, deviceCode, project, deployment },
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
      keys: r.many.apiKey(),
      projects: r.many.project(),
      users: r.many.user({
        from: r.org.id.through(r.orgMember.orgId),
        to: r.user.id.through(r.orgMember.userId),
      }),
    },
    orgMember: {
      org: r.one.org({ from: r.orgMember.orgId, to: r.org.id }),
      user: r.one.user({ from: r.orgMember.userId, to: r.user.id }),
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
    },
    deployment: {
      project: r.one.project({ from: r.deployment.projectId, to: r.project.projectId }),
    },
  }),
)
