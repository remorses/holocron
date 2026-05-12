// Deploy command — builds a holocron site for Cloudflare Workers and uploads
// the built artifacts to holocron.so via content-addressable zip-batched uploads.
//
// Content-addressable: each file is SHA-256 hashed locally. The server checks
// which hashes already exist in KV and returns them. Only new files are uploaded,
// skipping unchanged content across deploys.
//
// Auth priority:
//   1. HOLOCRON_KEY env var (API key, project resolved server-side)
//   2. ~/.holocron/config.json session token (from `holocron login`)
//
// Upload protocol:
//   1. POST /api/v0/deployments — declare file+hash pairs, get existingHashes
//   2. PUT /api/v0/deployments/:id/files — upload zip of NEW files only (skip existing)
//   3. POST /api/v0/deployments/:id/finalize — verify blobs, write site-info, go live

import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import * as clack from '@clack/prompts'
import { goke, isAgent } from 'goke'
import { zipSync } from 'fflate'
import { getDeployAuthHeaders, getDeployClient, type DeployAuth } from './api-client.ts'
import { logger, colors as c, formatBytes } from './logger.ts'

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
    output.log(logger.step(isPullRequest ? `Branch: ${c.bold(branch)} ${c.dim('(preview, PR detected)')}` : `Branch: ${c.bold(branch)}`))

    // ── Build (runs BEFORE auth so GitHub OIDC is minted as late as possible) ───
    if (!options.skipBuild) {
      const buildErr = await runBuild(cwd)
      if (buildErr instanceof Error) {
        output.error(logger.error('Build failed'))
        return proc.exit(1)
      }
    }

    // ── Auth (after build, so GitHub OIDC tokens stay fresh) ──────────────
    let deployClient: Awaited<ReturnType<typeof getDeployClient>>
    try {
      deployClient = await getDeployClient()
    } catch (err) {
      output.error(logger.error(err instanceof Error ? err.message : String(err)))
      return proc.exit(1)
    }
    const { safeFetch, auth } = deployClient

    // ── Resolve project (only needed for session auth) ────────────
    const projectId = auth.type === 'session' && !options.project
      ? await resolveProjectId({ safeFetch, nonInteractive, output, proc })
      : options.project

    if (projectId instanceof Error) return proc.exit(1) // error already logged

    // ── Collect build artifacts ───────────────────────────────────
    const files = collectBuildArtifacts(cwd)
    if (files instanceof Error) {
      output.error(logger.error(files.message))
      return proc.exit(1)
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0)
    output.log(logger.step(`Found ${c.bold(String(files.length))} files ${c.dim(`(${formatBytes(totalSize)})`)}`))

    // ── Read site name from docs.json for project name sync ───────
    const siteName = readSiteName(cwd)

    // ── Step 1: Create deployment ─────────────────────────────────
    output.log(logger.step('Creating deployment...'))
    const createRes = await safeFetch('/api/v0/deployments', {
      method: 'POST',
      body: {
        files: files.map((f) => ({ path: f.relativePath, hash: f.hash })),
        branch,
        ...(isPullRequest && { preview: true }),
        ...(projectId && { projectId }),
        ...(siteName && { name: siteName }),
      },
    })
    if (createRes instanceof Error) {
      output.error(logger.error(`Failed to create deployment: ${createRes.message}`))
      return proc.exit(1)
    }
    const { deploymentId, version, existingHashes } = createRes
    output.log(logger.success(`Deployment ${c.bold(deploymentId)} ${c.dim(`(v${version})`)} created`))

    // ── Step 2: Upload only new files (skip those already in KV) ─
    const existingSet = new Set(existingHashes)
    const newFiles = files.filter((f) => !existingSet.has(f.hash))
    const skippedCount = files.length - newFiles.length
    const skippedSize = files.filter((f) => existingSet.has(f.hash)).reduce((sum, f) => sum + f.size, 0)

    if (skippedCount > 0) {
      output.log(logger.step(`Skipping ${c.bold(String(skippedCount))} unchanged files ${c.dim(`(${formatBytes(skippedSize)})`)}`))
    }

    const uploadErr = newFiles.length > 0
      ? await uploadFiles({ files: newFiles, deploymentId, auth, baseUrl: auth.baseUrl, output })
      : undefined
    if (uploadErr instanceof Error) {
      output.error(logger.error(uploadErr.message))
      output.error(logger.error('Deploy aborted — deployment remains in "uploading" state and can be retried'))
      return proc.exit(1)
    }

    // ── Step 3: Finalize deployment ───────────────────────────────
    output.log(logger.step('Finalizing deployment...'))
    const finalizeClient = auth.type === 'github-oidc'
      ? await getDeployClient().catch((err) => err instanceof Error ? err : new Error(String(err)))
      : deployClient
    if (finalizeClient instanceof Error) {
      output.error(logger.error(finalizeClient.message))
      return proc.exit(1)
    }
    const finalizeRes = await finalizeClient.safeFetch(`/api/v0/deployments/${deploymentId}/finalize`, {
      method: 'POST',
      body: {},
    })
    if (finalizeRes instanceof Error) {
      output.error(logger.error(`Failed to finalize: ${finalizeRes.message}`))
      return proc.exit(1)
    }
    output.log('')
    output.log(logger.success(`Deployed! ${c.bold(finalizeRes.url)}`))

    // Auto-set GitHub Actions step outputs so users don't need to parse stdout
    const ghOutputFile = process.env.GITHUB_OUTPUT
    if (ghOutputFile) {
      fs.appendFileSync(ghOutputFile, `holocron_url=${finalizeRes.url}\n`)
      fs.appendFileSync(ghOutputFile, `holocron_deployment_id=${deploymentId}\n`)
      output.log(logger.step(c.dim('GitHub Actions step outputs set: holocron_url, holocron_deployment_id')))
    }
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
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch { return 'main' }
}

/** Run vite build and reload .env afterward. Returns Error on failure. */
async function runBuild(cwd: string): Promise<Error | void> {
  const buildCmd = detectBuildCommand(cwd)
  try {
    execSync(buildCmd, { cwd, stdio: 'inherit', env: { ...process.env, HOLOCRON_DEPLOY: '1' } })
  } catch {
    return new Error('Build failed')
  }
  // Reload .env — user build steps may have written HOLOCRON_KEY or HOLOCRON_BRANCH
  try {
    const { config } = await import('dotenv')
    config({ path: path.resolve(cwd, '.env'), override: true })
  } catch { /* dotenv not available or .env missing */ }
}

type BuildFile = { relativePath: string; absPath: string; size: number; hash: string }

/** Collect dist/rsc/** and dist/client/** into upload-ready file list with SHA-256 hashes. */
function collectBuildArtifacts(cwd: string): Error | BuildFile[] {
  const distDir = path.resolve(cwd, 'dist')
  if (!fs.existsSync(distDir)) return new Error('No dist/ directory found. Run the build first or remove --skip-build.')

  const files: BuildFile[] = []

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
  safeFetch: Awaited<ReturnType<typeof getDeployClient>>['safeFetch']
  nonInteractive: boolean
  output: { log: (msg: string) => void; error: (msg: string) => void }
  proc: { exit: (code: number) => void }
}): Promise<string | Error> {
  const res = await ctx.safeFetch('/api/v0/projects')
  if (res instanceof Error) {
    ctx.output.error(logger.error(`Failed to list projects: ${res.message}`))
    return res
  }
  const projects = res.projects
  if (projects.length === 0) {
    ctx.output.error(logger.error('No projects found. Create one first: holocron projects create --name "My Docs"'))
    return new Error('No projects')
  }
  if (projects.length === 1) return projects[0]!.projectId
  if (ctx.nonInteractive) {
    ctx.output.error(logger.error('Multiple projects found. Pass --project <id> to select one.'))
    return new Error('Multiple projects')
  }
  const selected = await clack.select({
    message: 'Select a project to deploy to:',
    options: projects.map((p) => ({ value: p.projectId, label: p.name, hint: p.projectId })),
  })
  if (clack.isCancel(selected)) return new Error('Cancelled')
  return selected
}

/** Max uncompressed size per zip batch. Files are grouped until this limit
 *  is reached, then a new batch starts. A single file larger than this
 *  gets its own batch. */
const MAX_BATCH_SIZE = 50 * 1024 * 1024 // 50 MB

/** Max files per zip batch. Caps parallel KV writes on the server side. */
const MAX_BATCH_FILES = 500

/** Group files into batches by total uncompressed size and file count. */
function createBatches(files: BuildFile[]): BuildFile[][] {
  const batches: BuildFile[][] = []
  let currentBatch: BuildFile[] = []
  let currentSize = 0

  for (const file of files) {
    if (currentBatch.length > 0 && (currentSize + file.size > MAX_BATCH_SIZE || currentBatch.length >= MAX_BATCH_FILES)) {
      batches.push(currentBatch)
      currentBatch = []
      currentSize = 0
    }
    currentBatch.push(file)
    currentSize += file.size
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

/** Upload files in zip-batched requests. Returns Error on first failure. */
async function uploadFiles(ctx: {
  files: BuildFile[]
  deploymentId: string
  auth: DeployAuth
  baseUrl: string
  output: { log: (msg: string) => void }
}): Promise<Error | void> {
  const batches = createBatches(ctx.files)
  let completed = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!
    const batchSize = batch.reduce((sum, f) => sum + f.size, 0)
    ctx.output.log(logger.step(`Batch ${i + 1}/${batches.length} ${c.dim(`(${batch.length} files, ${formatBytes(batchSize)})`)}`))

    // Build zip archive: keys are relative paths, values are file content
    const zipInput: Record<string, Uint8Array> = {}
    for (const file of batch) {
      zipInput[file.relativePath] = new Uint8Array(fs.readFileSync(file.absPath))
    }
    const zipData = zipSync(zipInput)

    const uploadUrl = new URL(`/api/v0/deployments/${ctx.deploymentId}/files`, ctx.baseUrl)
    let authHeaders: Record<string, string>
    try {
      authHeaders = await getDeployAuthHeaders(ctx.auth)
    } catch (err) {
      return new Error(err instanceof Error ? err.message : String(err))
    }
    let res: Response
    try {
      res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { ...authHeaders, 'Content-Type': 'application/zip' },
        body: Buffer.from(zipData),
      })
    } catch (err) {
      return new Error(`Upload batch ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return new Error(`Upload batch ${i + 1} failed: ${res.status} ${text}`)
    }

    completed += batch.length
    ctx.output.log(logger.success(`[${completed}/${ctx.files.length}] uploaded`))
  }
}

/** Recursively collect files from a directory with SHA-256 content hashes. */
function collectFiles(
  dir: string,
  prefix: string,
  files: BuildFile[],
  filter?: (relativePath: string) => boolean,
) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name)
    const relPath = `${prefix}/${entry.name}`
    if (entry.isDirectory()) {
      collectFiles(absPath, relPath, files, filter)
    } else if (entry.isFile()) {
      if (filter && !filter(relPath)) continue
      const content = fs.readFileSync(absPath)
      files.push({
        relativePath: relPath,
        absPath,
        size: content.byteLength,
        hash: createHash('sha256').update(content).digest('hex'),
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

const CONFIG_FILE_NAMES = ['docs.json', 'docs.jsonc', 'holocron.jsonc'] as const

// JSONC parser — strips comments and trailing commas while preserving string
// contents (e.g. URLs with "//"). Copied from vite/src/lib/jsonc.ts to avoid
// cross-package import. Regex approach from tiny-jsonc: captures strings as $1,
// matches comments as non-captured groups, replace keeps only $1.
const stringOrCommentRe = /("(?:\\?[^])*?")|(\/\/.*)|(\/\*[^]*?\*\/)/g
const stringOrTrailingCommaRe = /("(?:\\?[^])*?")|(,\s*)(?=]|})/g

function parseJsonc(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return JSON.parse(
      text
        .replace(stringOrCommentRe, '$1')
        .replace(stringOrTrailingCommaRe, '$1'),
    )
  }
}

/** Read the site name from docs.json/docs.jsonc/holocron.jsonc.
 *  Returns undefined if no config found or name is missing. */
function readSiteName(cwd: string): string | undefined {
  for (const name of CONFIG_FILE_NAMES) {
    const filePath = path.join(cwd, name)
    if (!fs.existsSync(filePath)) continue
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const parsed = parseJsonc(raw)
      if (parsed && typeof parsed === 'object' && typeof (parsed as Record<string, unknown>).name === 'string') {
        return (parsed as Record<string, unknown>).name as string
      }
    } catch { /* ignore parse errors, deploy can proceed without name */ }
    return undefined // found a config file but no name
  }
  return undefined
}
