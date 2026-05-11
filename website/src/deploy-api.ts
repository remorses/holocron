// Deploy API routes: create deployment, upload file, finalize.
//
// Upload protocol:
//   1. POST /api/v0/deployments — declare file list, get deploymentId + version
//   2. PUT /api/v0/deployments/:deploymentId/files/* — upload each file as raw bytes
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
import {
  getDb,
  requireSession,
  ensureOrg,
  validateApiKey,
} from './db.ts'

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
            .regex(/^[A-Za-z0-9._\-/]+$/, 'Invalid characters in file path')
            .refine((p) => !p.split('/').includes('..'), 'Path traversal not allowed')
            .refine((p) => p.startsWith('assets/') || p.startsWith('worker/'), 'Path must start with assets/ or worker/')
            .refine((p) => p !== 'worker/__dw_entry.js', 'Reserved path'),
        )
        .min(1)
        .max(2000)
        .describe('File paths to upload'),
      projectId: z.string().optional().describe('Required for session auth; ignored for API key auth'),
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
        files: JSON.stringify(body.files),
      })

      return { deploymentId, version }
    },
  })

  // Step 2: Upload a single file (plain * wildcard, filePath in params['*'])
  .route({
    method: 'PUT',
    path: '/api/v0/deployments/:deploymentId/files/*',
    params: z.object({
      deploymentId: z.string(),
      '*': z.string(),
    }),
    detail: {
      summary: 'Upload deployment file',
      tags: ['Deploy'],
    },
    response: {
      200: z.object({ ok: z.boolean() }),
    },
    async handler({ request, params }) {
      const filePath = params['*']
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

      // Verify the file path was declared
      const declaredFiles: string[] = JSON.parse(deploy.files || '[]')
      if (!declaredFiles.includes(filePath)) {
        throw json(
          { error: `file path "${filePath}" was not declared in the deployment` },
          { status: 400 },
        )
      }

      // Read raw body and store in KV (max 25MB per file, KV value limit)
      const content = await request.arrayBuffer()
      const MAX_FILE_SIZE = 25 * 1024 * 1024
      if (content.byteLength > MAX_FILE_SIZE) {
        throw json(
          { error: `file "${filePath}" exceeds 25MB limit (${(content.byteLength / 1024 / 1024).toFixed(1)}MB)` },
          { status: 413 },
        )
      }
      const kvKey = `site:${deploy.projectId}/v:${deploy.version}/${filePath}`
      await env.SITES_KV.put(kvKey, content)

      return { ok: true }
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
      200: z.object({ url: z.string(), deploymentId: z.string() }),
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

      // Build asset manifest from uploaded client assets
      // Build manifest: map browser paths (e.g. /assets/style.css) to content types.
      // CLI uploads dist/client/ files under the "assets/" prefix, so a file like
      // dist/client/assets/style.css becomes "assets/assets/style.css" in KV.
      // The browser requests /assets/style.css, so we strip the "assets" prefix.
      const assetFiles = declaredFiles.filter((f) => f.startsWith('assets/'))
      const manifest: Record<string, { contentType: string }> = {}
      for (const assetPath of assetFiles) {
        const ext = assetPath.split('.').pop() || ''
        // "assets/assets/style.css" → "/assets/style.css"
        const browserPath = '/' + assetPath.slice('assets/'.length)
        manifest[browserPath] = {
          contentType: guessMimeType(ext),
        }
      }
      await env.SITES_KV.put(
        `${prefix}manifest`,
        JSON.stringify(manifest),
      )

      // Subdomain is the lowercased projectId (ULID). Guaranteed unique,
      // no collision risk, and auth is already enforced via API key → projectId.
      const subdomain = deploy.projectId.toLowerCase()

      // Atomic batch: supersede all active deployments, activate this one,
      // and update the project pointer. D1 batch runs all statements in a
      // single transaction so concurrent finalizes can't interleave.
      await db.batch([
        db.update(schema.deployment)
          .set({ status: 'superseded' })
          .where(
            orm.and(
              orm.eq(schema.deployment.projectId, deploy.projectId),
              orm.eq(schema.deployment.status, 'active'),
            ),
          ),
        db.update(schema.deployment)
          .set({ status: 'active' })
          .where(orm.eq(schema.deployment.id, deploy.id)),
        db.update(schema.project)
          .set({
            subdomain,
            currentDeploymentId: deploy.id,
            updatedAt: Date.now(),
          })
          .where(orm.eq(schema.project.projectId, deploy.projectId)),
      ])

      // Derive the hosting domain from the request origin (preview vs production)
      const requestHost = new URL(request.url).hostname
      const isPreview = requestHost.startsWith('preview.')
      const siteSuffix = isPreview ? '-site-preview.holocron.so' : '-site.holocron.so'
      const url = `https://${subdomain}${siteSuffix}`
      return { url, deploymentId: deploy.id }
    },
  })

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
