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

    // ── Branch detection ─────────────────────────────────────────
    // Priority: explicit flag > HOLOCRON_BRANCH (from vite plugin OIDC) > GitHub CI env > git
    let branch = options.branch
    if (!branch) branch = process.env.HOLOCRON_BRANCH || undefined
    if (!branch && process.env.GITHUB_HEAD_REF) {
      // PR event: GITHUB_HEAD_REF is the source branch
      branch = process.env.GITHUB_HEAD_REF
    }
    if (!branch && process.env.GITHUB_REF) {
      const ref = process.env.GITHUB_REF
      if (ref.startsWith('refs/heads/')) {
        branch = ref.slice('refs/heads/'.length)
      }
      // Ignore refs/tags/ and other ref types
    }
    if (!branch) {
      try {
        const { execSync } = await import('node:child_process')
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd,
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        }).trim()
      } catch { /* not a git repo or git not installed */ }
    }
    branch = branch || 'main'

    // Detect if this is a PR deploy — PRs are always preview to prevent
    // a PR branch named "main" from overwriting production.
    const isPullRequest = !!(process.env.GITHUB_HEAD_REF || process.env.HOLOCRON_PREVIEW)
    if (isPullRequest) {
      output.log(`Branch: ${branch} (preview, PR detected)`)
    } else {
      output.log(`Branch: ${branch}`)
    }

    // ── Build (runs BEFORE auth so OIDC can write HOLOCRON_KEY to .env) ───
    if (!options.skipBuild) {
      output.log('Building for Cloudflare Workers...')
      const { execSync } = await import('node:child_process')
      const buildCmd = detectBuildCommand(cwd)
      try {
        execSync(buildCmd, {
          cwd,
          stdio: 'inherit',
          env: { ...process.env, HOLOCRON_DEPLOY: '1' },
        })
      } catch {
        output.error('Build failed.')
        return proc.exit(1)
      }

      // Reload .env after the build — the vite plugin's OIDC flow may have
      // written HOLOCRON_KEY and HOLOCRON_BRANCH during the build step.
      try {
        const { config } = await import('dotenv')
        config({ path: path.resolve(cwd, '.env'), override: true })
      } catch { /* dotenv not available or .env missing — non-fatal */ }

      // Re-detect branch from env if the build set HOLOCRON_BRANCH
      if (!options.branch && process.env.HOLOCRON_BRANCH) {
        branch = process.env.HOLOCRON_BRANCH
      }
    }

    // ── Auth (after build, so OIDC-written HOLOCRON_KEY is available) ─────
    let auth: DeployAuth
    try {
      auth = resolveDeployAuth()
    } catch (err) {
      output.error((err as Error).message)
      return proc.exit(1)
    }

    const { safeFetch } = getDeployClient()

    // ── Resolve project (only needed for session auth) ────────────
    let projectId = options.project
    if (auth.type === 'session' && !projectId) {
      const res = await safeFetch('/api/v0/projects')
      if (res instanceof Error) {
        output.error(`Failed to list projects: ${res.message}`)
        return proc.exit(1)
      }
      const projects = res.projects as Array<{ projectId: string; name: string }>
      if (projects.length === 0) {
        output.error('No projects found. Create one first: holocron projects create --name "My Docs"')
        return proc.exit(1)
      }
      if (projects.length === 1) {
        projectId = projects[0]!.projectId
      } else if (nonInteractive) {
        output.error('Multiple projects found. Pass --project <id> to select one.')
        return proc.exit(1)
      } else {
        const selected = await clack.select({
          message: 'Select a project to deploy to:',
          options: projects.map((p) => ({
            value: p.projectId,
            label: p.name,
            hint: p.projectId,
          })),
        })
        if (clack.isCancel(selected)) return proc.exit(1)
        projectId = selected
      }
    }

    // ── Collect build artifacts ───────────────────────────────────
    const distDir = path.resolve(cwd, 'dist')
    if (!fs.existsSync(distDir)) {
      output.error(`No dist/ directory found. Run the build first or remove --skip-build.`)
      return proc.exit(1)
    }

    const files: Array<{ relativePath: string; absPath: string; size: number }> = []

    // Worker modules: dist/rsc/** (both SSR and RSC environments)
    // The SSR entry (dist/rsc/ssr/index.js) imports the RSC entry (dist/rsc/index.js)
    // via relative path "../index.js", so both need to be uploaded preserving the
    // directory structure: worker/ssr/* and worker/* (RSC root).
    const rscDir = path.join(distDir, 'rsc')
    if (fs.existsSync(rscDir)) {
      collectFiles(rscDir, 'worker', files, (relPath) => {
        // Skip the generated wrangler.json (platform config, not code)
        return !relPath.endsWith('wrangler.json')
      })
    }

    // Client assets: dist/client/**
    const clientDir = path.join(distDir, 'client')
    if (fs.existsSync(clientDir)) {
      collectFiles(clientDir, 'assets', files)
    }

    if (files.length === 0) {
      output.error('No build artifacts found in dist/. Is the build configured correctly?')
      return proc.exit(1)
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    output.log(`Found ${files.length} files (${formatBytes(totalSize)})`)

    // ── Step 1: Create deployment ─────────────────────────────────
    output.log('Creating deployment...')
    const filePaths = files.map((f) => f.relativePath)
    const createBody: { files: string[]; projectId?: string; branch?: string; preview?: boolean } = { files: filePaths, branch }
    if (isPullRequest) createBody.preview = true
    if (projectId) createBody.projectId = projectId

    const createRes = await safeFetch('/api/v0/deployments', {
      method: 'POST',
      body: createBody,
    })
    if (createRes instanceof Error) {
      output.error(`Failed to create deployment: ${createRes.message}`)
      return proc.exit(1)
    }
    const { deploymentId, version } = createRes as { deploymentId: string; version: string }
    output.log(`Deployment ${deploymentId} (v${version}) created`)

    // ── Step 2: Upload files in parallel (max 6) ──────────────────
    output.log('Uploading files...')
    let completed = 0
    const MAX_CONCURRENT = 6
    const authToken = auth.type === 'apikey' ? auth.key : auth.token

    async function uploadOne(file: { relativePath: string; absPath: string }) {
      const content = fs.readFileSync(file.absPath)
      const encodedPath = file.relativePath.split('/').map(encodeURIComponent).join('/')
      const uploadUrl = new URL(
        `/api/v0/deployments/${deploymentId}/files/${encodedPath}`,
        auth.baseUrl,
      )
      const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/octet-stream',
        },
        body: content,
      })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Upload failed for ${file.relativePath}: ${res.status} ${text}`)
      }
      completed++
      output.log(`  [${completed}/${files.length}] ${file.relativePath}`)
    }

    // Upload in batches of MAX_CONCURRENT
    try {
      for (let i = 0; i < files.length; i += MAX_CONCURRENT) {
        const batch = files.slice(i, i + MAX_CONCURRENT)
        await Promise.all(batch.map(uploadOne))
      }
    } catch (err) {
      output.error(err instanceof Error ? err.message : String(err))
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
