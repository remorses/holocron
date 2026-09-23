// Maintains MDX pages by updating them from their generation prompts with OpenCode.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import * as clack from '@clack/prompts'
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import type { Config as OpencodeConfig } from '@opencode-ai/sdk/v2/types'
import { createRequire } from 'node:module'
import { goke, isAgent } from 'goke'
import dedent from 'string-dedent'
import { Agent, type RequestInit as UndiciRequestInit } from 'undici'
import { remark } from 'remark'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import { getDeployClient } from './api-client.ts'
import { createEventPrinter, formatServerLog, streamOpencodeEvents } from './maintain-events.ts'
import { logger, colors as c, actionableDetailFromFetchError, printActionableError } from './logger.ts'
import {
  didGenerationPromptChange,
  discoverMaintainPages,
  getGenerationPrompt,
  findRepoRoot,
  getChangedFiles,
  getChangedPatches,
  getHeadSha,
  getWorkingTreeChanges,
  extractPromptReferences,
  hasMissingLocalReferences,
  matchChangedReferences,
  type MaintainPage,
} from './maintain-discovery.ts'
import {
  loadGithubEvent,
  MAINTAIN_BRANCH_PREFIX,
  openMaintainPullRequest,
  prepareMaintainBranch,
  readGithubPublishEnv,
  readMaintainResult,
  resolveBaseBranch,
  type GithubMaintainRelease,
  type MaintainState,
} from './maintain-github.ts'

const RUN_TIMEOUT_MS = 25 * 60 * 1000
const HOSTED_PROVIDER = 'holocron'
const require = createRequire(import.meta.url)
const BYOK_MODEL_EXAMPLE = 'anthropic/claude-sonnet-4-5'
const EMPTY_MODEL_MESSAGE = `Pass a model id, for example glm-5.3-flash or ${BYOK_MODEL_EXAMPLE}.`
const PROVIDER_MODEL_MESSAGE = `Use provider/model, for example ${BYOK_MODEL_EXAMPLE}.`

export type MaintainModelChoice =
  | { kind: 'hosted'; modelId?: string }
  | { kind: 'byok'; providerId: string; modelId: string }

export function parseMaintainModel(value?: string): MaintainModelChoice | Error {
  if (value === undefined) return { kind: 'hosted' }
  const trimmed = value.trim()
  if (!trimmed) return new Error(EMPTY_MODEL_MESSAGE)
  if (trimmed.toLowerCase().startsWith(`${HOSTED_PROVIDER}/`)) {
    const modelId = trimmed.slice(trimmed.indexOf('/') + 1)
    if (!modelId) return new Error(EMPTY_MODEL_MESSAGE)
    return { kind: 'hosted', modelId }
  }
  const slash = trimmed.indexOf('/')
  if (slash === -1) return { kind: 'hosted', modelId: trimmed }
  if (slash === 0 || slash === trimmed.length - 1) {
    return new Error(PROVIDER_MODEL_MESSAGE)
  }
  return {
    kind: 'byok',
    providerId: trimmed.slice(0, slash),
    modelId: trimmed.slice(slash + 1),
  }
}

export const maintainCli = goke()

maintainCli
  .command('maintain', 'Maintain documentation from generation prompts and changed sources')
  .option('--all', 'Review all prompted pages, or every page with `--prompt` or `--prompt-file`')
  .option('--since [ref]', 'Detect source changes between the merge base of this Git ref and HEAD')
  .option('--prompt [text]', 'Add instructions for this run without changing page frontmatter')
  .option('--prompt-file [path]', 'Read run instructions from a Markdown file')
  .option('--dry-run', 'Show matched pages without calling a model')
  .option('--model [id]', 'Holocron-hosted model, or `provider/model` for your own OpenCode keys')
  .option('--project [projectId]', 'Project ID (only needed with session auth when multiple projects exist)')
  .example('holocron maintain --since origin/main --dry-run')
  .example('holocron maintain --all --prompt-file .holocron/prompts/weekly-review.md')
  .example('holocron maintain --model glm-5.3-flash')
  .example(`holocron maintain --model ${BYOK_MODEL_EXAMPLE}`)
  .action(async (options, { console: output, process: proc }) => {
    if (options.prompt && options.promptFile) {
      output.error(logger.error('Use either --prompt or --prompt-file, not both.'))
      return proc.exit(2)
    }
    const modelChoice = parseMaintainModel(options.model)
    if (modelChoice instanceof Error) {
      output.error(logger.error(modelChoice.message))
      return proc.exit(2)
    }

    const repoRoot = findRepoRoot(proc.cwd)
    const githubEvent = loadGithubEvent()
    if (githubEvent instanceof Error) {
      output.error(logger.error(githubEvent.message))
      return proc.exit(1)
    }
    const explicitRange = options.since
      ? { from: options.since, to: 'HEAD', pullRequest: true }
      : undefined
    const range = explicitRange ?? githubEvent?.range
    const all = !!options.all || (!explicitRange && githubEvent?.all === true)
    const runPrompt = options.promptFile
      ? fs.readFileSync(path.resolve(proc.cwd, options.promptFile), 'utf8')
      : options.prompt
    const runPromptFile = options.promptFile
      ? path.relative(repoRoot, path.resolve(proc.cwd, options.promptFile)).replaceAll('\\', '/')
      : undefined
    const pages = discoverMaintainPages(repoRoot, range?.from)
    const changedFiles = all ? [] : getChangedFiles(repoRoot, range)
    const changedUrls = githubEvent?.changedUrls ?? []
    const selectedPages = pages.filter((page) => {
      if (page.promptError) return false
      if (all) return !!page.prompt || !!runPrompt
      if (hasMissingLocalReferences(repoRoot, page.references)) return true
      if (range && didGenerationPromptChange(repoRoot, page, range.from)) return true
      return matchChangedReferences({ references: page.references, changedFiles, changedUrls }).length > 0
    })

    output.log(logger.step(`Found ${c.bold(String(pages.length))} documentation pages`))
    for (const page of pages) {
      if (page.promptError) output.error(logger.error(`${page.path}: ${page.promptError}`))
    }
    output.log(logger.step(`Matched ${c.bold(String(selectedPages.length))} page${selectedPages.length === 1 ? '' : 's'}`))
    for (const page of selectedPages) output.log(`  ${page.path}`)
    if (range) output.log(logger.step(`Git range ${c.bold(gitDiffRangeSpec(range))} (${changedFiles.length} changed file${changedFiles.length === 1 ? '' : 's'})`))
    if (options.dryRun || selectedPages.length === 0) return

    const beforeChangedFiles = new Set(getWorkingTreeChanges(repoRoot))
    const startSha = getHeadSha(repoRoot)
    const patches = range ? getChangedPatches(repoRoot, range, changedFiles) : ''
    const githubState: MaintainState | undefined = process.env.GITHUB_ACTIONS === 'true'
      ? {
        repoRoot,
        baseSha: startSha,
        branch: `${MAINTAIN_BRANCH_PREFIX}${Date.now()}`,
        targetBranch: resolveBaseBranch({ repoRoot, event: githubEvent }),
        pages: selectedPages.map((page) => page.path),
      }
      : undefined
    const publish = githubState ? readGithubPublishEnv(process.env) : undefined
    if (publish instanceof Error) {
      output.error(logger.error(publish.message))
      return proc.exit(1)
    }
    const githubActions = githubState
      ? prepareMaintainBranch({ state: githubState, binPath: fileURLToPath(new URL('./bin.js', import.meta.url)) })
      : undefined
    if (githubActions instanceof Error) {
      output.error(logger.error(githubActions.message))
      return proc.exit(1)
    }
    const openCodeArgs = {
      repoRoot,
      pages: selectedPages,
      runPrompt,
      runPromptFile,
      changedFiles,
      patches,
      gitDiffRange: range ? gitDiffRangeSpec(range) : undefined,
      release: githubEvent?.release,
      githubActions: githubState && githubActions
        ? { branch: githubState.branch, targetBranch: githubState.targetBranch, env: githubActions.env }
        : undefined,
    }
    let runError: Error | undefined
    let finalText = ''

    if (modelChoice.kind === 'byok') {
      if (options.project) {
        output.log(logger.warn('--project is ignored when using your own OpenCode provider.'))
      }
      output.log(logger.step(`Using ${c.bold(`${modelChoice.providerId}/${modelChoice.modelId}`)} with your OpenCode keys`))
      output.log(logger.step('Starting OpenCode...'))
      const result = await runOpenCode({
        ...openCodeArgs,
        log: (line) => output.log(line),
        model: modelChoice,
      })
      if (result instanceof Error) runError = result
      else finalText = result.finalText
    } else {
      let clientResult: Awaited<ReturnType<typeof getDeployClient>>
      try {
        clientResult = await getDeployClient()
      } catch (error) {
        output.error(logger.error(error instanceof Error ? error.message : String(error)))
        return proc.exit(1)
      }

      const projectId = clientResult.auth.type === 'session'
        ? await resolveProjectId({ safeFetch: clientResult.safeFetch, explicit: options.project, output })
        : undefined
      if (projectId instanceof Error) return proc.exit(1)

      const run = await clientResult.safeFetch('/api/v0/maintain/runs', {
        method: 'POST',
        body: { ...(projectId && { projectId }) },
      })
      if (run instanceof Error) {
        printActionableError(output, actionableDetailFromFetchError(run), run.message)
        return proc.exit(1)
      }

      const modelId = modelChoice.modelId ?? run.modelId
      const hostedModels = run.models ?? []
      try {
        if (modelChoice.modelId && !hostedModels.includes(modelChoice.modelId)) {
          runError = new Error(
            `Unknown Holocron model ${modelChoice.modelId}. Available: ${hostedModels.join(', ')}. To use your own provider key, pass provider/model, for example anthropic/${modelChoice.modelId}.`,
          )
        } else {
          output.log(logger.step(`Using Holocron-hosted ${c.bold(modelId)}. Billed to this project's subscription.`))
          output.log(logger.step('Starting OpenCode...'))
          const result = await runOpenCode({
            ...openCodeArgs,
            log: (line) => output.log(line),
            model: {
              kind: 'hosted',
              apiKey: run.apiKey,
              baseUrl: run.baseUrl,
              providerId: run.providerId,
              modelId,
              models: hostedModels,
            },
          })
          if (result instanceof Error) runError = result
          else finalText = result.finalText
        }
      } finally {
        const completionClient = clientResult.auth.type === 'github-oidc'
          ? await getDeployClient().catch((error) => error instanceof Error ? error : new Error(String(error)))
          : clientResult
        if (completionClient instanceof Error) {
          runError ??= completionClient
        } else {
          const completed = await completionClient.safeFetch(`/api/v0/maintain/runs/${run.runId}/complete`, {
            method: 'POST',
            params: { runId: run.runId },
            body: { projectId: run.projectId },
          })
          if (completed instanceof Error) runError ??= completed
        }
      }
    }
    if (runError) {
      output.error(logger.error(runError.message))
      return proc.exit(1)
    }

    const committed = getChangedFiles(repoRoot, { from: startSha, to: 'HEAD' })
    const working = getWorkingTreeChanges(repoRoot)
    const changedPages = selectedPages.filter((page) => committed.includes(page.path) || working.includes(page.path))
    const unexpected = [...new Set([
      ...committed.filter((file) => !selectedPages.some((page) => page.path === file)),
      ...working.filter((file) => !beforeChangedFiles.has(file) && !selectedPages.some((page) => page.path === file)),
    ])]
    if (unexpected.length > 0) {
      output.error(logger.error(`OpenCode changed files outside the selected pages: ${unexpected.join(', ')}`))
      return proc.exit(1)
    }
    const validation = validateChangedPages({ repoRoot, pages: changedPages })
    if (validation instanceof Error) {
      output.error(logger.error(validation.message))
      return proc.exit(1)
    }
    if (changedPages.length === 0) {
      output.log(logger.success('Documentation is already current.'))
      return
    }
    output.log(logger.success(`Updated ${changedPages.length} page${changedPages.length === 1 ? '' : 's'}.`))
    if (!githubState || !githubActions) return

    // Pages changed, so OpenCode must have committed them and run maintain-open-pr.
    const result = readMaintainResult(githubActions.stateDir)
    if (!result) {
      output.error(logger.error(`OpenCode changed ${changedPages.map((page) => page.path).join(', ')} but did not run \`holocron maintain-open-pr\`.`))
      if (finalText.trim()) output.error(`OpenCode's last message:\n${finalText.trim()}`)
      return proc.exit(1)
    }
    const pullRequestUrl = await openMaintainPullRequest({ state: githubState, publish: publish!, title: result.title, body: result.body })
    if (pullRequestUrl instanceof Error) {
      output.error(logger.error(pullRequestUrl.message))
      return proc.exit(1)
    }
    output.log(logger.success(`Opened ${pullRequestUrl}`))
  })

async function resolveProjectId({
  safeFetch,
  explicit,
  output,
}: {
  safeFetch: Awaited<ReturnType<typeof getDeployClient>>['safeFetch']
  explicit?: string
  output: { error: (message: string) => void }
}) {
  if (explicit) return explicit
  const result = await safeFetch('/api/v0/projects')
  if (result instanceof Error) {
    printActionableError(output, actionableDetailFromFetchError(result), result.message)
    return result
  }
  if (result.projects.length === 1) return result.projects[0]!.projectId
  if (result.projects.length === 0) {
    output.error(logger.error('No Holocron projects found.'))
    output.error(logger.error('Create one, then pass --project <projectId>.'))
    output.error(logger.error('Run: npx -y "@holocron.so/cli" projects create --name "My Docs"'))
    return new Error('No projects found. Create one with `holocron projects create`.')
  }
  if (isAgent || !process.stdin.isTTY) {
    output.error(logger.error('Multiple projects found. Pass --project <projectId>.'))
    output.error(logger.error('Usage: holocron maintain --project <projectId>'))
    output.error(logger.error('Run `holocron whoami` to list project IDs.'))
    return new Error('Multiple projects found. Pass --project <id>.')
  }
  const selected = await clack.select({
    message: 'Select a project for Maintain:',
    options: result.projects.map((project) => ({
      value: project.projectId,
      label: project.orgName ? `${project.name} (${project.orgName})` : project.name,
      hint: project.projectId,
    })),
  })
  if (clack.isCancel(selected)) {
    output.error(logger.error('Cancelled.'))
    return new Error('Cancelled')
  }
  return selected
}

async function runOpenCode({
  repoRoot,
  pages,
  runPrompt,
  runPromptFile,
  changedFiles,
  patches,
  gitDiffRange,
  release,
  githubActions,
  model,
  log,
}: {
  log: (line: string) => void
  repoRoot: string
  pages: MaintainPage[]
  runPrompt?: string
  runPromptFile?: string
  changedFiles: string[]
  patches: string
  gitDiffRange?: string
  release?: GithubMaintainRelease
  githubActions?: { branch: string; targetBranch: string; env: Record<string, string> }
  model:
    | {
      kind: 'hosted'
      apiKey: string
      baseUrl: string
      providerId: string
      modelId: string
      models: string[]
    }
    | Extract<MaintainModelChoice, { kind: 'byok' }>
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS)
  // Relaxed on purpose: allow-lists were not inherited by task subagents anyway. Only deny rules
  // reach subagents, so the hard limits are denies. The CLI checks the changed files after the run.
  const permission = [
    { permission: '*', pattern: '*', action: 'allow' as const },
    { permission: 'bash', pattern: 'git push *', action: 'deny' as const },
    { permission: 'bash', pattern: 'gh *', action: 'deny' as const },
  ]

  const providerId = model.providerId
  const modelId = model.modelId
  const server = await startOpencodeServer({
    signal: controller.signal,
    env: githubActions?.env,
    onLog: (line) => log(formatServerLog(line)),
    config: {
      model: `${providerId}/${modelId}`,
      provider: model.kind === 'hosted'
        ? {
          [providerId]: {
            npm: '@ai-sdk/openai-compatible',
            options: { apiKey: model.apiKey, baseURL: model.baseUrl, timeout: RUN_TIMEOUT_MS },
            models: Object.fromEntries(
              (model.models.length > 0 ? model.models : [modelId]).map((id) => [id, { name: id }]),
            ),
          },
        }
        : undefined,
    },
  })
  if (server instanceof Error) {
    clearTimeout(timeout)
    return server
  }
  const events = new AbortController()
  try {
    const client = createMaintainClient({ baseUrl: server.url, directory: repoRoot })
    const session = await client.session.create({
      title: 'Maintain Holocron documentation',
      model: { id: modelId, providerID: providerId },
      permission,
    }, { throwOnError: true })
    void streamOpencodeEvents({
      client,
      directory: repoRoot,
      signal: events.signal,
      printer: createEventPrinter({ repoRoot, rootSessionID: session.data.id, write: log }),
    }).catch((error) => log(c.dim(`  opencode event stream stopped: ${error instanceof Error ? error.message : String(error)}`)))

    const system = buildMaintainSystemPrompt({ gitDiffRange })
    const prompt = buildMaintainUserPrompt({
      pages,
      changedFiles,
      patches,
      runPrompt,
      runPromptFile,
      release,
      githubActions,
    })
    const result = await client.session.prompt({
      sessionID: session.data.id,
      model: { providerID: providerId, modelID: modelId },
      agent: 'build',
      system,
      tools: { bash: true, websearch: false, task: true, read: true, glob: true, grep: true, edit: true, webfetch: true },
      parts: [{ type: 'text', text: prompt }],
    }, { throwOnError: true })
    // HTTP 200 does not mean the turn succeeded: provider failures land on info.error.
    const failure = result.data.info.error
    if (failure) {
      const message = failure.name === 'MessageOutputLengthError' ? 'The model hit its output length limit.' : failure.data.message
      return openCodeFailed({
        kind: model.kind,
        prefix: `OpenCode failed to maintain the selected pages (${failure.name}).`,
        detail: message ? ` ${message}` : '',
      })
    }
    return { finalText: result.data.parts.flatMap((part) => part.type === 'text' ? [part.text] : []).join('\n') }
  } catch (error) {
    if (controller.signal.aborted) {
      return new Error(`OpenCode did not finish within ${RUN_TIMEOUT_MS / 60_000} minutes.`)
    }
    const message = error instanceof Error ? error.message : String(error)
    return openCodeFailed({
      kind: model.kind,
      prefix: 'OpenCode failed to maintain the selected pages.',
      detail: message ? ` ${message}` : '',
    })
  } finally {
    clearTimeout(timeout)
    events.abort()
    await server.close()
  }
}

// `session.prompt` blocks until the whole run finishes, and Node's fetch
// (undici) aborts any request whose response headers take longer than
// 5 minutes (`headersTimeout`) with a bare "fetch failed". Long maintain
// runs died at exactly 5:00. The 25 minute budget is enforced by the caller.
export function createMaintainClient({ baseUrl, directory }: { baseUrl: string; directory: string }) {
  // Node's fetch accepts undici's `dispatcher` init; the DOM RequestInit type does not know it.
  const init: RequestInit & Pick<UndiciRequestInit, 'dispatcher'> = {
    dispatcher: new Agent({ headersTimeout: 0, bodyTimeout: 0 }),
  }
  return createOpencodeClient({
    baseUrl,
    directory,
    fetch: (request) => fetch(request, init),
  })
}

export function resolveOpencodeBinary() {
  return require.resolve('opencode-ai/bin/opencode.exe')
}

// Spawns the pinned opencode binary by absolute path. The SDK's createOpencodeServer
// resolves `opencode` on PATH, which hits pnpm's `node_modules/.bin/opencode` sh shim.
// That shim runs the binary without `exec`, so killing the shim orphaned `opencode.exe`,
// which kept the stdio pipes open and hung `holocron maintain` until the CI job timed out.
export async function startOpencodeServer({
  config,
  signal,
  env,
  onLog,
  startTimeoutMs = 30_000,
}: {
  config: OpencodeConfig
  signal?: AbortSignal
  env?: Record<string, string>
  /** Receives server warnings and errors (`--print-logs --log-level WARN`) after startup. */
  onLog?: (line: string) => void
  startTimeoutMs?: number
}): Promise<{ url: string; pid: number; close: () => Promise<void> } | Error> {
  const logArgs = onLog ? ['--print-logs', '--log-level=WARN'] : []
  const proc = spawn(resolveOpencodeBinary(), ['serve', '--hostname=127.0.0.1', '--port=0', ...logArgs], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !CREDENTIAL_ENV.includes(key))), ...env, OPENCODE_CONFIG_CONTENT: JSON.stringify(config) },
  })
  // Spawn failures emit 'error' and may never emit 'exit'.
  const exited = new Promise<void>((resolve) => {
    proc.once('exit', () => resolve())
    proc.once('error', () => resolve())
  })
  const close = async () => {
    stopProcess(proc)
    const killTimer = setTimeout(() => proc.kill('SIGKILL'), 5_000)
    await exited
    clearTimeout(killTimer)
    // Release our read ends so a leaked grandchild holding the pipes cannot keep Node alive.
    proc.stdout?.destroy()
    proc.stderr?.destroy()
  }
  const onAbort = () => void close()
  signal?.addEventListener('abort', onAbort, { once: true })
  proc.once('exit', () => signal?.removeEventListener('abort', onAbort))

  let output = ''
  const url = await new Promise<string | Error>((resolve) => {
    const timer = setTimeout(() => {
      resolve(new Error(`Timeout waiting for OpenCode server to start after ${startTimeoutMs}ms`))
    }, startTimeoutMs)
    const onData = (chunk: Buffer) => {
      output += chunk.toString()
      const match = output.match(/^opencode server listening on\s+(https?:\/\/\S+)/m)
      if (!match) return
      clearTimeout(timer)
      resolve(match[1]!)
    }
    proc.stdout?.on('data', onData)
    proc.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString()
    })
    proc.once('exit', (code) => {
      clearTimeout(timer)
      resolve(new Error(`OpenCode server exited with code ${code}${output.trim() ? `\n${output}` : ''}`))
    })
    proc.once('error', (error) => {
      clearTimeout(timer)
      resolve(error)
    })
  })
  if (url instanceof Error) {
    await close()
    return new Error('OpenCode server failed to start.', { cause: url })
  }
  if (onLog) {
    let pending = ''
    proc.stderr?.on('data', (chunk: Buffer) => {
      pending += chunk.toString()
      const lines = pending.split('\n')
      pending = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) onLog(line.trim())
    })
  }
  return { url, pid: proc.pid!, close }
}

// The model can run any shell command, so it must not see tokens that push code, open PRs,
// or mint GitHub OIDC tokens. The CLI keeps them and publishes after the run.
const CREDENTIAL_ENV = ['GITHUB_TOKEN', 'GH_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_URL', 'ACTIONS_RUNTIME_TOKEN', 'HOLOCRON_KEY']

function stopProcess(proc: ChildProcess) {
  if (proc.exitCode !== null || proc.signalCode !== null) return
  if (process.platform === 'win32' && proc.pid) {
    const out = spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { windowsHide: true })
    if (!out.error && out.status === 0) return
  }
  proc.kill()
}

function openCodeFailed({
  kind,
  prefix,
  detail,
}: {
  kind: 'hosted' | 'byok'
  prefix: string
  detail: string
}) {
  const hint = kind === 'byok'
    ? ' Check the model id (`opencode models`) and the provider key: https://opencode.ai/docs/providers/'
    : ''
  return new Error(`${prefix}${detail}${hint}`)
}

function githubActionsPublishPrompt({
  branch,
  targetBranch,
}: {
  branch: string
  targetBranch: string
}) {
  return dedent`
    You are running in GitHub Actions on the branch ${branch}, created for this run. Holocron pushes it and opens the pull request into ${targetBranch} after you finish.

    If no selected page changed, you are done. Do not commit and do not run any holocron command.

    If any selected MDX pages changed, after the tasks finish:
    1. Commit only the changed MDX pages with git add and git commit. The commit author is already set through the environment. Do not run git config.
    2. Run this, with the pull request body on stdin:
       holocron maintain-open-pr --title "<title>" <<'EOF'
       - short bullet for each change
       EOF
       Title: short. Prefix with [holocron], unless this repository has a clear commit title convention in git log, then follow that.
       Body: a short bullet list of the changes. No headings.

    Never push, switch branches, or run gh. If a holocron command fails, fix what it reports and run it again.
    Do the commit and the command yourself. Do not ask tasks to commit.
  `
}

function buildMaintainSystemPrompt({ gitDiffRange }: { gitDiffRange?: string }) {
  const diffHint = gitDiffRange
    ? dedent`
      To see what changed in a source file, run git.

      git diff ${gitDiffRange} -- path/to/file
      git log -p ${gitDiffRange} -- path/to/file
    `
    : 'There is no source change range for this run. Read the referenced sources as they are now.'
  return dedent`
    You update Holocron documentation pages. You do not generate pages from scratch.

    Each selected page has a frontmatter prompt. Use that prompt to update the existing page. Keep the same @/ paths and @https:// URLs unless the sources or coverage actually changed. Leave a page unchanged when the source changes do not affect it.

    Split the work with tasks. Each task owns exclusive pages. Never assign one page to two tasks. Tasks may read the repository. Tasks may only edit their assigned selected MDX pages. Tasks must not commit.

    Resolve @./ and @../ relative to that page. Resolve @/ from the repository root. Resolve @https:// and @http:// as remote sources. Bare URLs without @ are not references. In a run-instruction file, relative refs are relative to that file. @/ still means the repository root.

    ${diffHint}

    Update a page's frontmatter prompt only when its source paths or intended coverage changed. Do not edit files outside the selected pages.
  `
}

function buildMaintainUserPrompt({
  pages,
  changedFiles,
  patches,
  runPrompt,
  runPromptFile,
  release,
  githubActions,
}: {
  pages: Pick<MaintainPage, 'path' | 'prompt' | 'references'>[]
  changedFiles: string[]
  patches: string
  runPrompt?: string
  runPromptFile?: string
  release?: GithubMaintainRelease
  githubActions?: { branch: string; targetBranch: string }
}) {
  return [
    '<selected_pages>',
    JSON.stringify(pages.map((page) => ({ path: page.path, prompt: page.prompt, references: page.references })), null, 2),
    '</selected_pages>',
    '',
    '<changed_files>',
    JSON.stringify(changedFiles, null, 2),
    '</changed_files>',
    '',
    'Run the selected page updates in tasks. Tell each task not to commit.',
    runPrompt
      ? `\n<run_instructions>\n${JSON.stringify({ file: runPromptFile ?? null, text: runPrompt }, null, 2)}\n</run_instructions>`
      : '',
    release
      ? `\n<github_release>\n${JSON.stringify(release, null, 2)}\n</github_release>`
      : '',
    patches
      ? `\n<source_patches>\n${JSON.stringify({ diff: patches }, null, 2)}\n</source_patches>`
      : '',
    githubActions
      ? `\n<github_actions>\n${githubActionsPublishPrompt(githubActions)}\n</github_actions>`
      : '\nDo not commit, push, or run gh. Leave the updated pages uncommitted.',
  ].filter((block) => block !== '').join('\n')
}

function gitDiffRangeSpec(range: { from: string; to: string; pullRequest?: boolean }) {
  if (/^0+$/.test(range.from)) return range.to
  const separator = range.pullRequest ? '...' : '..'
  return `${range.from}${separator}${range.to}`
}

function validateChangedPages({ repoRoot, pages }: { repoRoot: string; pages: MaintainPage[] }) {
  const parser = remark().use(remarkFrontmatter).use(remarkMdx)
  for (const page of pages) {
    if (!fs.existsSync(page.absolutePath)) return new Error(`OpenCode deleted ${page.path}.`)
    try {
      const content = fs.readFileSync(page.absolutePath, 'utf8')
      parser.parse(content)
      const nextPrompt = getGenerationPrompt(content)
      if (page.prompt && !nextPrompt) return new Error(`OpenCode removed the generation prompt from ${page.path}.`)
      if (nextPrompt) extractPromptReferences({ prompt: nextPrompt, pagePath: page.absolutePath, repoRoot })
    } catch (error) {
      return new Error(`Invalid MDX in ${page.path}.`, { cause: error })
    }
  }
}


