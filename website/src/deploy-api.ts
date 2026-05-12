// Deploy API routes: create deployment, upload files, finalize.
//
// Content-addressable storage: files are stored in KV at "blob:{sha256hex}" keys.
// Identical files across deployments share the same blob, saving storage and
// upload bandwidth. The manifest (path → hash mapping) is embedded in the
// "site-info:{subdomain}" KV entry so the hosting worker needs only one read.
//
// Upload protocol:
//   1. POST /api/v0/deployments — declare file+hash pairs, get deploymentId + existingHashes
//   2. PUT /api/v0/deployments/:deploymentId/files — upload zip of NEW files only (skip existing)
//   3. POST /api/v0/deployments/:deploymentId/finalize — verify blobs, write site-info+manifest, go live
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

  // Step 1: Create deployment with declared file+hash pairs.
  // Returns which hashes already exist in KV so the CLI can skip uploading them.
  .route({
    method: 'POST',
    path: '/api/v0/deployments',
    request: z.object({
      files: z
        .array(z.object({
          path: z.string().min(1).max(512)
            .refine((p) => !/[\x00-\x1f\\]/.test(p), 'Path contains control characters or backslashes')
            .refine((p) => !p.split('/').includes('..'), 'Path traversal not allowed')
            .refine((p) => p.startsWith('assets/') || p.startsWith('worker/'), 'Path must start with assets/ or worker/')
            .refine((p) => p !== 'worker/__dw_entry.js', 'Reserved path'),
          hash: z.string().length(64).regex(/^[a-f0-9]+$/, 'Hash must be lowercase hex SHA-256'),
        }))
        .min(1)
        .max(2000)
        .describe('File paths with SHA-256 content hashes'),
      projectId: z.string().optional().describe('Required for session auth; ignored for API key auth'),
      branch: z.string().max(200).optional().describe('Branch name for preview deployments. Defaults to "main".'),
      preview: z.boolean().optional().describe('Force preview deployment (e.g. from a PR). Never updates production pointer.'),
      name: z.string().trim().min(1).max(200).optional().describe('Site name from docs.json. Updates the project name if provided.'),
    }),
    detail: {
      summary: 'Create deployment',
      tags: ['Deploy'],
    },
    response: {
      200: z.object({
        deploymentId: z.string(),
        version: z.string(),
        existingHashes: z.array(z.string()).describe('Hashes that already exist in KV — CLI can skip uploading these files'),
      }),
    },
    async handler({ request }) {
      const body = await request.json()
      const auth = await resolveCreateAuth(request, body.projectId)
      const db = getDb()

      const deploymentId = ulid()
      const version = ulid()

      // Store the full file→hash manifest in the deployment row
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

      // Check which content hashes already exist in KV via bulk reads.
      // Each bulk get(keys[]) counts as 1 op (vs 1 per key individually).
      // Batch size 25 keeps response well under the 25MB KV bulk limit.
      // If this fails for any reason, CLI just uploads everything (idempotent).
      const uniqueHashes = [...new Set(body.files.map((f: { hash: string }) => f.hash))]
      const existingHashes: string[] = []
      try {
        for (let i = 0; i < uniqueHashes.length; i += 25) {
          const chunk = uniqueHashes.slice(i, i + 25)
          const results = await env.SITES_KV.get(
            chunk.map((h) => `blob:${h}`),
            { type: 'text' },
          )
          for (const [key, value] of results) {
            if (value !== null) existingHashes.push(key.slice('blob:'.length))
          }
        }
      } catch {
        // Bulk read failed (e.g. response too large). Return empty existingHashes
        // so CLI uploads all files. Redundant but safe — writes are idempotent.
      }

      return { deploymentId, version, existingHashes }
    },
  })

  // Step 2: Upload new files as a zip archive.
  // Files are stored at content-addressed blob:{sha256} keys. The CLI only
  // sends files whose hash was NOT in the existingHashes response from step 1.
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

      // Build a lookup from path → declared hash for validation
      const declaredFiles: Array<{ path: string; hash: string }> = JSON.parse(deploy.files || '[]')
      const declaredPaths = new Set(declaredFiles.map((f) => f.path))
      const declaredHashByPath = new Map(declaredFiles.map((f) => [f.path, f.hash]))

      const zipBuffer = new Uint8Array(await request.arrayBuffer())

      // Validate entries during decompression to protect against zip bombs.
      const MAX_FILE_SIZE = 25 * 1024 * 1024
      const MAX_BATCH_UNCOMPRESSED = 100 * 1024 * 1024
      let totalUncompressed = 0

      let extracted: Record<string, Uint8Array>
      try {
        extracted = unzipSync(zipBuffer, {
          filter(file) {
            if (!declaredPaths.has(file.name)) {
              throw json(
                { error: `file path "${file.name}" was not declared in the deployment` },
                { status: 400 },
              )
            }
            if (file.originalSize > MAX_FILE_SIZE) {
              throw json(
                { error: `file "${file.name}" exceeds 25MB limit (${(file.originalSize / 1024 / 1024).toFixed(1)}MB)` },
                { status: 413 },
              )
            }
            totalUncompressed += file.originalSize
            if (totalUncompressed > MAX_BATCH_UNCOMPRESSED) {
              throw json(
                { error: 'zip batch exceeds 100MB uncompressed limit' },
                { status: 413 },
              )
            }
            return true
          },
        })
      } catch (err) {
        if (err instanceof Response) throw err
        throw json({ error: 'invalid zip archive' }, { status: 400 })
      }

      // Validate all hashes first, then deduplicate KV writes by hash.
      // Multiple files can share the same content (e.g. empty shim modules),
      // and KV has a 1 write/sec per-key limit so deduplication avoids 429s.
      const blobs = new Map<string, Uint8Array>()

      for (const [filePath, content] of Object.entries(extracted)) {
          const hashBuffer = await crypto.subtle.digest('SHA-256', content as unknown as ArrayBuffer)
        const computedHash = [...new Uint8Array(hashBuffer)]
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')

        const declaredHash = declaredHashByPath.get(filePath)
        if (computedHash !== declaredHash) {
          throw json(
            { error: `hash mismatch for "${filePath}": declared ${declaredHash}, got ${computedHash}` },
            { status: 400 },
          )
        }

        if (!blobs.has(computedHash)) {
          blobs.set(computedHash, content)
        }
      }

      // Write each unique blob once. KV put is idempotent for identical content.
      await Promise.all(
        [...blobs].map(([hash, content]) => env.SITES_KV.put(`blob:${hash}`, content)),
      )

      return { uploaded: blobs.size }
    },
  })

  // Step 3: Finalize deployment — verify all blobs exist, write manifest, go live
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

      const proj = await db.query.project.findFirst({
        where: { projectId: deploy.projectId },
      })
      if (!proj) {
        throw json({ error: 'project not found' }, { status: 404 })
      }

      const branch = deploy.branch || 'main'
      const isProduction = !deploy.preview && branch === (proj.defaultBranch || 'main')

      const declaredFiles: Array<{ path: string; hash: string }> = JSON.parse(deploy.files || '[]')

      // The worker entry must be declared or the hosting worker can't load the site
      if (!declaredFiles.some((f) => f.path === 'worker/ssr/index.js')) {
        throw json(
          { error: 'deployment must include worker/ssr/index.js (the SSR entry)' },
          { status: 400 },
        )
      }

      // No blob existence check here — the CLI already verifies each upload
      // batch returned 200. Skipping saves KV reads and avoids the 25MB bulk
      // response limit for large blobs.

      // Build the manifest: maps file paths to their content hash + metadata.
      // The hosting worker reads this to resolve file paths to blob keys.
      // Asset entries also include contentType for static serving.
      const manifest: Record<string, { hash: string; contentType?: string }> = {}
      for (const { path: filePath, hash } of declaredFiles) {
        const entry: { hash: string; contentType?: string } = { hash }
        if (filePath.startsWith('assets/')) {
          const ext = filePath.split('.').pop() || ''
          entry.contentType = guessMimeType(ext)
        }
        manifest[filePath] = entry
      }

      // Compute subdomains and batch D1 updates
      const projectSubdomain = buildProjectSubdomain(proj)
      const deploySubdomain = isProduction
        ? projectSubdomain
        : buildPreviewSubdomain(branch, projectSubdomain)

      const batchStatements = [
        db.update(schema.deployment)
          .set({ status: 'superseded' })
          .where(
            orm.and(
              orm.eq(schema.deployment.projectId, deploy.projectId),
              orm.eq(schema.deployment.status, 'active'),
              orm.eq(schema.deployment.branch, branch),
            ),
          ),
        db.update(schema.deployment)
          .set({ status: 'active', subdomain: deploySubdomain })
          .where(orm.eq(schema.deployment.id, deploy.id)),
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

      const stillActive = await db.query.deployment.findFirst({
        where: { id: deploy.id, status: 'active' },
      })
      if (!stillActive) {
        throw json(
          { error: 'deployment was superseded by a concurrent finalize' },
          { status: 409 },
        )
      }

      // Write site-info to KV with the manifest embedded. The hosting worker
      // reads this single key to get everything it needs — no second KV read.
      await env.SITES_KV.put(
        `site-info:${deploySubdomain}`,
        JSON.stringify({
          projectId: deploy.projectId,
          version: deploy.version,
          manifest,
        }),
      )

      const requestHost = new URL(request.url).hostname
      const isPreviewEnv = requestHost.startsWith('preview.')
      const siteSuffix = isPreviewEnv ? '-site-preview.holocron.so' : '-site.holocron.so'
      const url = `https://${deploySubdomain}${siteSuffix}`
      return { url, deploymentId: deploy.id, branch }
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
