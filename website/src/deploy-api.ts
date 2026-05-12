// Deploy API routes: create deployment, upload files, finalize.
//
// Upload protocol:
//   1. POST /api/v0/deployments — declare file list, get deploymentId + version
//   2. PUT /api/v0/deployments/:deploymentId/files — batch upload via multipart/form-data
//   3. POST /api/v0/deployments/:deploymentId/finalize — validate, build manifest, go live
//
// Auth: both API key (HOLOCRON_KEY) and session token are supported.
// API key auth resolves the project from the key.
// Session auth needs projectId in the create body; upload/finalize derive
// the projectId from the deployment row and verify org membership.

import { json, Spiceflow } from 'spiceflow'
import { z } from 'zod'
import * as orm from 'drizzle-orm'
import * as schema from 'db/schema'
import { env } from 'cloudflare:workers'
import { ulid } from 'ulid'
import { unzipSync } from 'fflate'
import {
  getDb,
  requireSession,
  ensureOrg,
  validateApiKey,
} from './db.ts'

// ── Subdomain helpers ───────────────────────────────────────────────

/** Sanitize a string for use in DNS hostnames. Only [a-z0-9-], max 63 chars. */
export function sanitizeForDns(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Build the project's base subdomain from github info or projectId.
 *  Format: `{repo}-{owner}` for OIDC projects, `{projectId}` for manual ones. */
export function buildProjectSubdomain(project: {
  githubOwner?: string | null
  githubRepo?: string | null
  projectId: string
}): string {
  if (project.githubOwner && project.githubRepo) {
    const raw = `${project.githubRepo}-${project.githubOwner}`
    const sanitized = sanitizeForDns(raw)
    if (sanitized.length <= 63) return sanitized
    // Truncate with deterministic hash suffix for uniqueness
    const hashNum = [...raw].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
    const suffix = Math.abs(hashNum).toString(36).slice(0, 6)
    return `${sanitized.slice(0, 63 - suffix.length - 1).replace(/-$/, '')}-${suffix}`
  }
  return project.projectId.toLowerCase()
}

/** Build a preview subdomain for a branch deployment.
 *  Format: `{sanitized-branch}-{hash}-{project-subdomain}`.
 *
 *  The hash is ALWAYS included (derived from the raw, unsanitized branch name)
 *  so that branches that sanitize identically (feature/auth, feature_auth,
 *  feature.auth) get distinct subdomains. Truncated to 63 chars if needed. */
export function buildPreviewSubdomain(branchName: string, projectSubdomain: string): string {
  const sanitizedBranch = sanitizeForDns(branchName) || 'branch'
  // djb2 hash of the raw branch name for deterministic uniqueness
  const hashNum = [...branchName].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
  const hashSuffix = Math.abs(hashNum).toString(36).slice(0, 6)
  const full = `${sanitizedBranch}-${hashSuffix}-${projectSubdomain}`
  if (full.length <= 63) return full
  // Truncate the branch part to fit, keeping hash + project subdomain intact
  const fixedLen = hashSuffix.length + 1 + projectSubdomain.length + 1
  const maxBranchLen = 63 - fixedLen
  if (maxBranchLen < 1) {
    // Project subdomain itself is near the limit
    return `${sanitizedBranch.slice(0, 4)}-${hashSuffix}-${projectSubdomain}`.slice(0, 63)
  }
  const truncated = sanitizedBranch.slice(0, maxBranchLen).replace(/-$/, '')
  return `${truncated}-${hashSuffix}-${projectSubdomain}`
}

// ── Auth helpers ────────────────────────────────────────────────────

type DeployAuth = { orgId: string; projectId: string }

/** Resolve auth for the create-deployment route. Needs bodyProjectId for session auth. */
async function resolveCreateAuth(request: Request, bodyProjectId?: string): Promise<DeployAuth> {
  const apiKeyAuth = await validateApiKey(request.headers.get('authorization'))
  if (apiKeyAuth) {
    return { orgId: apiKeyAuth.orgId, projectId: apiKeyAuth.projectId }
  }

  const session = await requireSession(request)
  const org = await ensureOrg(session.userId, session.user.name)

  if (!bodyProjectId) {
    throw json({ error: 'projectId is required when using session auth' }, { status: 400 })
  }

  const db = getDb()
  const proj = await db.query.project.findFirst({
    where: { projectId: bodyProjectId, orgId: org.id },
  })
  if (!proj) {
    throw json({ error: 'project not found in your org' }, { status: 404 })
  }

  return { orgId: org.id, projectId: bodyProjectId }
}

/** Verify the caller has access to the project that owns a deployment.
 *  Used by upload and finalize routes where projectId comes from the deployment row. */
async function requireDeployAccess(request: Request, projectId: string): Promise<void> {
  const apiKeyAuth = await validateApiKey(request.headers.get('authorization'))
  if (apiKeyAuth) {
    if (apiKeyAuth.projectId !== projectId) {
      throw json({ error: 'deployment does not belong to your project' }, { status: 403 })
    }
    return
  }

  const session = await requireSession(request)
  const org = await ensureOrg(session.userId, session.user.name)
  const db = getDb()
  const proj = await db.query.project.findFirst({
    where: { projectId, orgId: org.id },
  })
  if (!proj) {
    throw json({ error: 'deployment does not belong to your project' }, { status: 403 })
  }
}

// ── Deploy app ──────────────────────────────────────────────────────

export const deployApp = new Spiceflow()

  // Step 1: Create a deployment with declared file list
  .route({
    method: 'POST',
    path: '/api/v0/deployments',
    request: z.object({
      files: z
        .array(
          z.string().min(1).max(512)
            .refine((p) => !/[\x00-\x1f\\]/.test(p), 'Path contains control characters or backslashes')
            .refine((p) => !p.split('/').includes('..'), 'Path traversal not allowed')
            .refine((p) => p.startsWith('assets/') || p.startsWith('worker/'), 'Path must start with assets/ or worker/')
            .refine((p) => p !== 'worker/__dw_entry.js', 'Reserved path'),
        )
        .min(1)
        .max(2000)
        .describe('File paths to upload'),
      projectId: z.string().optional().describe('Required for session auth; ignored for API key auth'),
      branch: z.string().max(200).optional().describe('Branch name for preview deployments. Defaults to "main".'),
      preview: z.boolean().optional().describe('Force preview deployment (e.g. from a PR). Never updates production pointer.'),
      name: z.string().max(200).optional().describe('Site name from docs.json. Updates the project name if provided.'),
    }),
    detail: {
      summary: 'Create deployment',
      tags: ['Deploy'],
    },
    response: {
      200: z.object({ deploymentId: z.string(), version: z.string() }),
    },
    async handler({ request }) {
      const body = await request.json()
      const auth = await resolveCreateAuth(request, body.projectId)
      const db = getDb()

      const deploymentId = ulid()
      const version = ulid()

      await db.insert(schema.deployment).values({
        id: deploymentId,
        projectId: auth.projectId,
        version,
        status: 'uploading',
        branch: body.branch || 'main',
        preview: body.preview ?? false,
        files: JSON.stringify(body.files),
      })

      // Bump project.updatedAt so the project list is ordered by last deploy activity.
      // Also sync project.name from docs.json if provided.
      await db.update(schema.project)
        .set({
          updatedAt: Date.now(),
          ...(body.name ? { name: body.name } : {}),
        })
        .where(orm.eq(schema.project.projectId, auth.projectId))

      return { deploymentId, version }
    },
  })

  // Step 2: Upload files as a zip archive (batch upload)
  .route({
    method: 'PUT',
    path: '/api/v0/deployments/:deploymentId/files',
    params: z.object({
      deploymentId: z.string(),
    }),
    detail: {
      summary: 'Upload deployment files (zip batch)',
      tags: ['Deploy'],
    },
    response: {
      200: z.object({ uploaded: z.number() }),
    },
    async handler({ request, params }) {
      const db = getDb()

      const deploy = await db.query.deployment.findFirst({
        where: { id: params.deploymentId },
      })
      if (!deploy) {
        throw json({ error: 'deployment not found' }, { status: 404 })
      }
      if (deploy.status !== 'uploading') {
        throw json({ error: 'deployment is not in uploading state' }, { status: 400 })
      }

      await requireDeployAccess(request, deploy.projectId)

      const declaredFiles: string[] = JSON.parse(deploy.files || '[]')
      const zipBuffer = new Uint8Array(await request.arrayBuffer())
      const extracted = unzipSync(zipBuffer)

      // Validate all files before writing any to KV
      const MAX_FILE_SIZE = 25 * 1024 * 1024
      const entries: Array<{ filePath: string; content: Uint8Array }> = []

      for (const [filePath, content] of Object.entries(extracted)) {
        if (!declaredFiles.includes(filePath)) {
          throw json(
            { error: `file path "${filePath}" was not declared in the deployment` },
            { status: 400 },
          )
        }
        if (content.byteLength > MAX_FILE_SIZE) {
          throw json(
            { error: `file "${filePath}" exceeds 25MB limit (${(content.byteLength / 1024 / 1024).toFixed(1)}MB)` },
            { status: 413 },
          )
        }
        entries.push({ filePath, content })
      }

      // Write all files to KV in parallel
      await Promise.all(
        entries.map(({ filePath, content }) => {
          const kvKey = `site:${deploy.projectId}/v:${deploy.version}/${filePath}`
          return env.SITES_KV.put(kvKey, content)
        }),
      )

      return { uploaded: entries.length }
    },
  })

  // Step 3: Finalize deployment
  .route({
    method: 'POST',
    path: '/api/v0/deployments/:deploymentId/finalize',
    params: z.object({
      deploymentId: z.string(),
    }),
    detail: {
      summary: 'Finalize deployment',
      tags: ['Deploy'],
    },
    response: {
      200: z.object({ url: z.string(), deploymentId: z.string(), branch: z.string() }),
    },
    async handler({ request, params }) {
      const db = getDb()

      const deploy = await db.query.deployment.findFirst({
        where: { id: params.deploymentId },
      })
      if (!deploy) {
        throw json({ error: 'deployment not found' }, { status: 404 })
      }

      // Allow re-finalize of already-active deployments so the KV site-info
      // write can be retried if it failed on the first attempt. D1 updates
      // are idempotent (same status + subdomain), and the KV write overwrites.
      if (deploy.status !== 'uploading' && deploy.status !== 'active') {
        throw json({ error: 'deployment is not in uploading or active state' }, { status: 400 })
      }

      await requireDeployAccess(request, deploy.projectId)

      // Get project info for subdomain computation and branch comparison
      const proj = await db.query.project.findFirst({
        where: { projectId: deploy.projectId },
      })
      if (!proj) {
        throw json({ error: 'project not found' }, { status: 404 })
      }

      const branch = deploy.branch || 'main'
      // A deployment is production ONLY when it targets the default branch AND
      // is not explicitly marked as preview. This prevents PR branches named
      // "main" from overwriting production (PRs always set preview=true).
      const isProduction = !deploy.preview && branch === (proj.defaultBranch || 'main')

      const declaredFiles: string[] = JSON.parse(deploy.files || '[]')
      const prefix = `site:${deploy.projectId}/v:${deploy.version}/`

      // The worker entry must exist or the hosting worker can't load the site
      if (!declaredFiles.includes('worker/ssr/index.js')) {
        throw json(
          { error: 'deployment must include worker/ssr/index.js (the SSR entry)' },
          { status: 400 },
        )
      }

      // Verify all files exist in KV by reading each key (not list, which is
      // eventually consistent). Each check is a fast HEAD-like KV.get metadata call.
      const missing: string[] = []
      await Promise.all(
        declaredFiles.map(async (filePath) => {
          const meta = await env.SITES_KV.getWithMetadata(prefix + filePath)
          if (meta.value === null) missing.push(filePath)
        }),
      )
      if (missing.length > 0) {
        throw json(
          { error: `missing files: ${missing.slice(0, 10).join(', ')}` },
          { status: 400 },
        )
      }

      // Build asset manifest from uploaded client assets.
      // CLI uploads dist/client/ files under the "assets/" prefix, so a file like
      // dist/client/assets/style.css becomes "assets/assets/style.css" in KV.
      // The browser requests /assets/style.css, so we strip the "assets" prefix.
      const assetFiles = declaredFiles.filter((f) => f.startsWith('assets/'))
      const manifest: Record<string, { contentType: string }> = {}
      for (const assetPath of assetFiles) {
        const ext = assetPath.split('.').pop() || ''
        const browserPath = '/' + assetPath.slice('assets/'.length)
        manifest[browserPath] = { contentType: guessMimeType(ext) }
      }
      await env.SITES_KV.put(`${prefix}manifest`, JSON.stringify(manifest))

      // Compute subdomains and build the D1 batch statements.
      // Both paths share the same supersede + activate pattern; production
      // additionally updates the project pointer.
      const projectSubdomain = buildProjectSubdomain(proj)
      const deploySubdomain = isProduction
        ? projectSubdomain
        : buildPreviewSubdomain(branch, projectSubdomain)

      const batchStatements = [
        // Supersede active deployments for this branch
        db.update(schema.deployment)
          .set({ status: 'superseded' })
          .where(
            orm.and(
              orm.eq(schema.deployment.projectId, deploy.projectId),
              orm.eq(schema.deployment.status, 'active'),
              orm.eq(schema.deployment.branch, branch),
            ),
          ),
        // Activate this deployment with the computed subdomain
        db.update(schema.deployment)
          .set({ status: 'active', subdomain: deploySubdomain })
          .where(orm.eq(schema.deployment.id, deploy.id)),
        // Production only: update the project pointer
        ...(isProduction ? [
          db.update(schema.project)
            .set({
              subdomain: projectSubdomain,
              currentDeploymentId: deploy.id,
              updatedAt: Date.now(),
            })
            .where(orm.eq(schema.project.projectId, deploy.projectId)),
        ] : []),
      ]
      await db.batch(batchStatements as [typeof batchStatements[0], ...typeof batchStatements])

      // Verify this deployment won the race before writing KV. A concurrent
      // finalize could have superseded us between the D1 batch and this write.
      const stillActive = await db.query.deployment.findFirst({
        where: { id: deploy.id, status: 'active' },
      })
      if (!stillActive) {
        throw json(
          { error: 'deployment was superseded by a concurrent finalize' },
          { status: 409 },
        )
      }
      await writeSiteInfoToKv(deploySubdomain, {
        projectId: deploy.projectId,
        version: deploy.version,
        files: declaredFiles,
      })

      const requestHost = new URL(request.url).hostname
      const isPreviewEnv = requestHost.startsWith('preview.')
      const siteSuffix = isPreviewEnv ? '-site-preview.holocron.so' : '-site.holocron.so'
      const url = `https://${deploySubdomain}${siteSuffix}`
      return { url, deploymentId: deploy.id, branch }
    },
  })

/** Write site resolution data to KV for the hosting worker.
 *  Key: "site-info:{subdomain}" — matches what the hosting worker reads. */
async function writeSiteInfoToKv(
  subdomain: string,
  data: { projectId: string; version: string; files: string[] },
): Promise<void> {
  await env.SITES_KV.put(
    `site-info:${subdomain}`,
    JSON.stringify(data),
  )
}

function guessMimeType(ext: string): string {
  const types: Record<string, string> = {
    js: 'application/javascript',
    mjs: 'application/javascript',
    css: 'text/css',
    html: 'text/html',
    json: 'application/json',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    txt: 'text/plain',
    xml: 'application/xml',
    wasm: 'application/wasm',
  }
  return types[ext.toLowerCase()] || 'application/octet-stream'
}

export type DeployApp = typeof deployApp
