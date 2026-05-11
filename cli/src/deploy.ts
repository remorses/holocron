// Deploy command — builds a holocron site for Cloudflare Workers and uploads
// the built artifacts to holocron.so via parallel per-file uploads.
//
// Auth priority:
//   1. HOLOCRON_KEY env var (API key, project resolved server-side)
//   2. ~/.holocron/config.json session token (from `holocron login`)
//
// Upload protocol:
//   1. POST /api/v0/deployments — declare file list, get deploymentId
//   2. PUT /api/v0/deployments/:id/files/* — upload each file (max 6 parallel)
//   3. POST /api/v0/deployments/:id/finalize — mark live, get URL

import fs from 'node:fs'
import path from 'node:path'
import * as clack from '@clack/prompts'
import { goke, isAgent } from 'goke'
import { resolveDeployAuth, getDeployClient, type DeployAuth } from './api-client.ts'

export const deployCli = goke()

deployCli
  .command('deploy', 'Build and deploy your docs site to holocron.so')
  .option('--project [projectId]', 'Project ID (only needed with session auth, not with HOLOCRON_KEY)')
  .option('--branch [name]', 'Branch name for preview deployments (auto-detected from git/CI env)')
  .option('--skip-build', 'Skip the vite build step (use existing dist/)')
  .action(async (options, { console: output, process: proc }) => {
    const cwd = proc.cwd
    const nonInteractive = isAgent || !process.stdin.isTTY

    const branch = detectBranch(cwd, options.branch)
    const isPullRequest = !!(process.env.GITHUB_HEAD_REF || process.env.HOLOCRON_PREVIEW)
    output.log(isPullRequest ? `Branch: ${branch} (preview, PR detected)` : `Branch: ${branch}`)

    // ── Build (runs BEFORE auth so OIDC can write HOLOCRON_KEY to .env) ───
    if (!options.skipBuild) {
      const buildErr = await runBuild(cwd)
      if (buildErr instanceof Error) {
        output.error('Build failed.')
        return proc.exit(1)
      }
    }

    // ── Auth (after build, so OIDC-written HOLOCRON_KEY is available) ─────
    const auth = (() => {
      try { return resolveDeployAuth() }
      catch (err) { return err as Error }
    })()
    if (auth instanceof Error) {
      output.error(auth.message)
      return proc.exit(1)
    }

    const { safeFetch } = getDeployClient()
    const authToken = auth.type === 'apikey' ? auth.key : auth.token

    // ── Resolve project (only needed for session auth) ────────────
    const projectId = auth.type === 'session' && !options.project
      ? await resolveProjectId({ safeFetch, nonInteractive, output, proc })
      : options.project

    if (projectId instanceof Error) return proc.exit(1) // error already logged

    // ── Collect build artifacts ───────────────────────────────────
    const files = collectBuildArtifacts(cwd)
    if (files instanceof Error) {
      output.error(files.message)
      return proc.exit(1)
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    output.log(`Found ${files.length} files (${formatBytes(totalSize)})`)

    // ── Step 1: Create deployment ─────────────────────────────────
    output.log('Creating deployment...')
    const createRes = await safeFetch('/api/v0/deployments', {
      method: 'POST',
      body: {
        files: files.map((f) => f.relativePath),
        branch,
        ...(isPullRequest && { preview: true }),
        ...(projectId && { projectId }),
      },
    })
    if (createRes instanceof Error) {
      output.error(`Failed to create deployment: ${createRes.message}`)
      return proc.exit(1)
    }
    const { deploymentId, version } = createRes as { deploymentId: string; version: string }
    output.log(`Deployment ${deploymentId} (v${version}) created`)

    // ── Step 2: Upload files in parallel (max 6) ──────────────────
    output.log('Uploading files...')
    const uploadErr = await uploadFiles({ files, deploymentId, authToken, baseUrl: auth.baseUrl, output })
    if (uploadErr instanceof Error) {
      output.error(uploadErr.message)
      output.error('Deploy aborted. The deployment remains in "uploading" state and can be retried.')
      return proc.exit(1)
    }

    // ── Step 3: Finalize deployment ───────────────────────────────
    output.log('Finalizing deployment...')
    const finalizeRes = await safeFetch(`/api/v0/deployments/${deploymentId}/finalize`, {
      method: 'POST',
      body: {},
    })
    if (finalizeRes instanceof Error) {
      output.error(`Failed to finalize deployment: ${finalizeRes.message}`)
      return proc.exit(1)
    }
    const finalized = finalizeRes as { url: string; deploymentId: string; branch: string }
    output.log('')
    output.log(`Deployed! ${finalized.url}`)
  })

// ── Extracted functions ──────────────────────────────────────────────

/** Detect branch from explicit flag, env vars, or git. Pure function, no side effects. */
function detectBranch(cwd: string, explicit?: string): string {
  if (explicit) return explicit
  if (process.env.HOLOCRON_BRANCH) return process.env.HOLOCRON_BRANCH
  if (process.env.GITHUB_HEAD_REF) return process.env.GITHUB_HEAD_REF
  const ref = process.env.GITHUB_REF
  if (ref?.startsWith('refs/heads/')) return ref.slice('refs/heads/'.length)
  try {
    const { execSync } = require('node:child_process')
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch { return 'main' }
}

/** Run vite build and reload .env afterward. Returns Error on failure. */
async function runBuild(cwd: string): Promise<Error | void> {
  const { execSync } = await import('node:child_process')
  const buildCmd = detectBuildCommand(cwd)
  try {
    execSync(buildCmd, { cwd, stdio: 'inherit', env: { ...process.env, HOLOCRON_DEPLOY: '1' } })
  } catch {
    return new Error('Build failed')
  }
  // Reload .env — the vite plugin OIDC flow may have written HOLOCRON_KEY + HOLOCRON_BRANCH
  try {
    const { config } = await import('dotenv')
    config({ path: path.resolve(cwd, '.env'), override: true })
  } catch { /* dotenv not available or .env missing */ }
}

/** Collect dist/rsc/** and dist/client/** into upload-ready file list. */
function collectBuildArtifacts(cwd: string): Error | Array<{ relativePath: string; absPath: string; size: number }> {
  const distDir = path.resolve(cwd, 'dist')
  if (!fs.existsSync(distDir)) return new Error('No dist/ directory found. Run the build first or remove --skip-build.')

  const files: Array<{ relativePath: string; absPath: string; size: number }> = []

  const rscDir = path.join(distDir, 'rsc')
  if (fs.existsSync(rscDir)) {
    collectFiles(rscDir, 'worker', files, (relPath) => !relPath.endsWith('wrangler.json'))
  }

  const clientDir = path.join(distDir, 'client')
  if (fs.existsSync(clientDir)) {
    collectFiles(clientDir, 'assets', files)
  }

  if (files.length === 0) return new Error('No build artifacts found in dist/. Is the build configured correctly?')
  return files
}

/** Interactively resolve projectId for session auth. Logs errors internally, returns Error on failure. */
async function resolveProjectId(ctx: {
  safeFetch: ReturnType<typeof getDeployClient>['safeFetch']
  nonInteractive: boolean
  output: { log: (msg: string) => void; error: (msg: string) => void }
  proc: { exit: (code: number) => void }
}): Promise<string | Error> {
  const res = await ctx.safeFetch('/api/v0/projects')
  if (res instanceof Error) {
    ctx.output.error(`Failed to list projects: ${res.message}`)
    return res
  }
  const projects = res.projects as Array<{ projectId: string; name: string }>
  if (projects.length === 0) {
    ctx.output.error('No projects found. Create one first: holocron projects create --name "My Docs"')
    return new Error('No projects')
  }
  if (projects.length === 1) return projects[0]!.projectId
  if (ctx.nonInteractive) {
    ctx.output.error('Multiple projects found. Pass --project <id> to select one.')
    return new Error('Multiple projects')
  }
  const selected = await clack.select({
    message: 'Select a project to deploy to:',
    options: projects.map((p) => ({ value: p.projectId, label: p.name, hint: p.projectId })),
  })
  if (clack.isCancel(selected)) return new Error('Cancelled')
  return selected
}

/** Upload files in parallel batches. Returns Error on first failure. */
async function uploadFiles(ctx: {
  files: Array<{ relativePath: string; absPath: string }>
  deploymentId: string
  authToken: string
  baseUrl: string
  output: { log: (msg: string) => void }
}): Promise<Error | void> {
  const MAX_CONCURRENT = 6
  let completed = 0

  for (let i = 0; i < ctx.files.length; i += MAX_CONCURRENT) {
    const batch = ctx.files.slice(i, i + MAX_CONCURRENT)
    const results = await Promise.all(batch.map(async (file) => {
      const content = fs.readFileSync(file.absPath)
      const encodedPath = file.relativePath.split('/').map(encodeURIComponent).join('/')
      const uploadUrl = new URL(`/api/v0/deployments/${ctx.deploymentId}/files/${encodedPath}`, ctx.baseUrl)
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ctx.authToken}`, 'Content-Type': 'application/octet-stream' },
        body: content,
      }).catch((e: unknown) => e instanceof Error ? e : new Error(String(e)))
      if (res instanceof Error) return new Error(`Upload failed for ${file.relativePath}: ${res.message}`)
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        return new Error(`Upload failed for ${file.relativePath}: ${res.status} ${text}`)
      }
      completed++
      ctx.output.log(`  [${completed}/${ctx.files.length}] ${file.relativePath}`)
    }))
    const firstErr = results.find((r): r is Error => r instanceof Error)
    if (firstErr) return firstErr
  }
}

/** Recursively collect files from a directory into the files array. */
function collectFiles(
  dir: string,
  prefix: string,
  files: Array<{ relativePath: string; absPath: string; size: number }>,
  filter?: (relativePath: string) => boolean,
) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name)
    const relPath = `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      collectFiles(absPath, relPath, files, filter)
    } else if (entry.isFile()) {
      if (filter && !filter(relPath)) continue
      files.push({
        relativePath: relPath,
        absPath,
        size: fs.statSync(absPath).size,
      })
    }
  }
}

/** Detect the project's package manager and return the vite build command. */
function detectBuildCommand(cwd: string): string {
  if (fs.existsSync(path.join(cwd, 'bun.lock')) || fs.existsSync(path.join(cwd, 'bun.lockb'))) {
    return 'bunx vite build'
  }
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm exec vite build'
  }
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    return 'yarn exec vite build'
  }
  return 'npx vite build'
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
