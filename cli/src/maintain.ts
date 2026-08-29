// Maintains MDX pages by updating them from their generation prompts with OpenCode.

import fs from 'node:fs'
import path from 'node:path'
import * as clack from '@clack/prompts'
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import { createOpencodeServer } from '@opencode-ai/sdk/v2/server'
import { goke, isAgent } from 'goke'
import dedent from 'string-dedent'
import { remark } from 'remark'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import { getDeployClient } from './api-client.ts'
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
import { loadGithubEvent, type GithubMaintainRelease } from './maintain-github.ts'

const RUN_TIMEOUT_MS = 25 * 60 * 1000
const HOSTED_PROVIDER = 'holocron'
const EMPTY_MODEL_MESSAGE = 'Pass a model id, for example glm-5.3-flash or anthropic/claude-sonnet-4.'

export type MaintainModelChoice =
  | { kind: 'hosted'; modelId?: string }
  | { kind: 'byok'; providerId: string; modelId: string }

export function parseMaintainModel(value?: string): MaintainModelChoice | Error {
  if (value === undefined) return { kind: 'hosted' }
  const trimmed = value.trim()
  if (!trimmed) return new Error(EMPTY_MODEL_MESSAGE)
  if (trimmed.startsWith(`${HOSTED_PROVIDER}/`)) {
    const modelId = trimmed.slice(HOSTED_PROVIDER.length + 1)
    if (!modelId) return new Error(EMPTY_MODEL_MESSAGE)
    return { kind: 'hosted', modelId }
  }
  const slash = trimmed.indexOf('/')
  if (slash === -1) return { kind: 'hosted', modelId: trimmed }
  if (slash === 0 || slash === trimmed.length - 1) {
    return new Error('Use provider/model, for example anthropic/claude-sonnet-4.')
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
  .example('holocron maintain --model anthropic/claude-sonnet-4')
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
    if (options.dryRun || selectedPages.length === 0) return

    const beforeChangedFiles = new Set(getWorkingTreeChanges(repoRoot))
    const startSha = getHeadSha(repoRoot)
    const patches = range ? getChangedPatches(repoRoot, range, changedFiles) : ''
    const githubActions = process.env.GITHUB_ACTIONS === 'true'
      ? {
        branch: `holocron/maintain-${Date.now()}`,
        targetBranch: githubEvent && !githubEvent.existingPullRequest ? githubEvent.baseBranch : 'main',
      }
      : undefined
    const openCodeArgs = {
      repoRoot,
      pages: selectedPages,
      runPrompt,
      runPromptFile,
      changedFiles,
      patches,
      gitDiffRange: gitDiffRangeSpec(range),
      release: githubEvent?.release,
      githubActions,
    }
    let runError: Error | undefined

    if (modelChoice.kind === 'byok') {
      output.log(logger.step(`Using ${c.bold(`${modelChoice.providerId}/${modelChoice.modelId}`)} with your OpenCode keys`))
      output.log(logger.step('Starting OpenCode...'))
      const result = await runOpenCode({
        ...openCodeArgs,
        model: modelChoice,
      })
      if (result instanceof Error) runError = result
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
      if (modelChoice.modelId && !(run.models ?? []).includes(modelChoice.modelId)) {
        output.error(logger.error(`Unknown Holocron model ${modelChoice.modelId}. Available: ${(run.models ?? []).join(', ')}`))
        const completed = await clientResult.safeFetch(`/api/v0/maintain/runs/${run.runId}/complete`, {
          method: 'POST',
          params: { runId: run.runId },
          body: { projectId: run.projectId },
        })
        if (completed instanceof Error) output.error(logger.error(completed.message))
        return proc.exit(2)
      }

      output.log(logger.step(`Using Holocron-hosted ${c.bold(modelId)}. Billed to this project's subscription.`))
      try {
        output.log(logger.step('Starting OpenCode...'))
        const result = await runOpenCode({
          ...openCodeArgs,
          model: {
            kind: 'hosted',
            apiKey: run.apiKey,
            baseUrl: run.baseUrl,
            providerId: run.providerId,
            modelId,
            models: run.models ?? [],
          },
        })
        if (result instanceof Error) runError = result
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
}: {
  repoRoot: string
  pages: MaintainPage[]
  runPrompt?: string
  runPromptFile?: string
  changedFiles: string[]
  patches: string
  gitDiffRange: string
  release?: GithubMaintainRelease
  githubActions?: { branch: string; targetBranch: string }
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
  const permission = [
    { permission: '*', pattern: '*', action: 'deny' as const },
    { permission: 'read', pattern: '*', action: 'allow' as const },
    { permission: 'glob', pattern: '*', action: 'allow' as const },
    { permission: 'grep', pattern: '*', action: 'allow' as const },
    { permission: 'task', pattern: '*', action: 'allow' as const },
    { permission: 'todowrite', pattern: '*', action: 'allow' as const },
    { permission: 'bash', pattern: 'git diff *', action: 'allow' as const },
    { permission: 'bash', pattern: 'git log *', action: 'allow' as const },
    ...(githubActions
      ? [
        { permission: 'bash', pattern: 'git *', action: 'allow' as const },
        { permission: 'bash', pattern: 'gh *', action: 'allow' as const },
        { permission: 'bash', pattern: `git push * ${githubActions.targetBranch}`, action: 'deny' as const },
        { permission: 'bash', pattern: `git push origin ${githubActions.targetBranch}`, action: 'deny' as const },
      ]
      : []),
    ...pages.flatMap((page) => [
      { permission: 'edit', pattern: page.path, action: 'allow' as const },
      { permission: 'edit', pattern: page.absolutePath, action: 'allow' as const },
    ]),
    ...pages.flatMap((page) => page.references.urls.map((url) => (
      { permission: 'webfetch', pattern: url, action: 'allow' as const }
    ))),
  ]

  const providerId = model.providerId
  const modelId = model.modelId
  const server = await createOpencodeServer({
    hostname: '127.0.0.1',
    port: 0,
    timeout: 30_000,
    signal: controller.signal,
    config: model.kind === 'hosted'
      ? {
        provider: {
          [providerId]: {
            npm: '@ai-sdk/openai-compatible',
            options: { apiKey: model.apiKey, baseURL: model.baseUrl },
            models: Object.fromEntries(
              (model.models.length > 0 ? model.models : [modelId]).map((id) => [id, { name: id }]),
            ),
          },
        },
      }
      : undefined,
  }).catch((error) => new Error('OpenCode server failed to start.', { cause: error }))
  if (server instanceof Error) {
    clearTimeout(timeout)
    return server
  }
  try {
    const client = createOpencodeClient({ baseUrl: server.url, directory: repoRoot })
    const sessionResult = await client.session.create({
      title: 'Maintain Holocron documentation',
      model: { id: modelId, providerID: providerId },
      permission,
    })
    if (sessionResult.error || !sessionResult.data) return new Error('OpenCode could not create a session.')

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
      sessionID: sessionResult.data.id,
      model: { providerID: providerId, modelID: modelId },
      agent: 'build',
      system,
      tools: { bash: true, websearch: false, task: true, read: true, glob: true, grep: true, edit: true, webfetch: true },
      parts: [{ type: 'text', text: prompt }],
    })
    if (result.error || !result.data) {
      return new Error(
        model.kind === 'byok'
          ? 'OpenCode failed to maintain the selected pages. Set the provider API key from https://opencode.ai/docs/providers/'
          : 'OpenCode failed to maintain the selected pages.',
      )
    }
  } catch (error) {
    return new Error('OpenCode maintain run failed.', { cause: error })
  } finally {
    clearTimeout(timeout)
    server.close()
  }
}

function githubActionsPublishPrompt({
  branch,
  targetBranch,
}: {
  branch: string
  targetBranch: string
}) {
  return dedent`
    You are running in GitHub Actions.

    After the page updates finish, if any selected MDX files were updated, publish them. If none were updated, do not create a branch, commit, or pull request.

    If files were updated:
    1. Create and switch to this new branch before any commit: ${branch}
    2. If git user.name is unset, set user.name to github-actions[bot] and user.email to 41898282+github-actions[bot]@users.noreply.github.com
    3. Commit only the updated MDX files
    4. Push only that branch. Never push to ${targetBranch}. Never push to any other existing branch. Never commit on ${targetBranch}.
    5. Open one pull request into ${targetBranch} with gh pr create.
       Title: short. Prefix with [holocron], unless this repository already has a clear PR title convention, then follow that.
       Body: a short bullet list of the changes. No headings.

    Do this yourself after tasks finish. Do not ask tasks to commit, create branches, or open pull requests.
  `
}

function buildMaintainSystemPrompt({ gitDiffRange }: { gitDiffRange: string }) {
  return dedent`
    You update Holocron documentation pages. You do not generate pages from scratch.

    Each selected page has a frontmatter prompt. Use that prompt to update the existing page. Keep the same @/ paths and @https:// URLs unless the sources or coverage actually changed. Leave a page unchanged when the source changes do not affect it.

    Split the work with tasks. Each task owns exclusive pages. Never assign one page to two tasks. Tasks may read the repository. Tasks may only edit their assigned selected MDX pages. Tasks must not commit.

    Resolve @./ and @../ relative to that page. Resolve @/ from the repository root. Resolve @https:// and @http:// as remote sources. Bare URLs without @ are not references. In a run-instruction file, relative refs are relative to that file. @/ still means the repository root.

    To see what changed in a source file, run git.

    git diff ${gitDiffRange} -- path/to/file
    git log -p ${gitDiffRange} -- path/to/file

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
      : '',
  ].filter((block) => block !== '').join('\n')
}

function gitDiffRangeSpec(range?: { from: string; to: string; pullRequest?: boolean }) {
  if (!range) return 'HEAD'
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


