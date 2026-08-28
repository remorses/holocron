// Maintains MDX pages by rerunning their generation prompts with OpenCode.

import fs from 'node:fs'
import path from 'node:path'
import childProcess from 'node:child_process'
import * as clack from '@clack/prompts'
import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import { createOpencodeServer } from '@opencode-ai/sdk/v2/server'
import { goke, isAgent } from 'goke'
import dedent from 'string-dedent'
import { remark } from 'remark'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdx from 'remark-mdx'
import { getDeployClient } from './api-client.ts'
import { logger, colors as c } from './logger.ts'
import {
  didGenerationPromptChange,
  discoverMaintainPages,
  getGenerationPrompt,
  findRepoRoot,
  getChangedFiles,
  getChangedPatches,
  extractPromptReferences,
  matchChangedReferences,
  type MaintainPage,
} from './maintain-discovery.ts'
import { loadGithubEvent, publishMaintainChanges, type GithubMaintainEvent } from './maintain-github.ts'

const RUN_TIMEOUT_MS = 25 * 60 * 1000

export const maintainCli = goke()

maintainCli
  .command('maintain', 'Maintain documentation from generation prompts and changed sources')
  .option('--all', 'Review all prompted pages, or every page with `--prompt` or `--prompt-file`')
  .option('--since [ref]', 'Detect source changes between the merge base of this Git ref and HEAD')
  .option('--prompt [text]', 'Add instructions for this run without changing page frontmatter')
  .option('--prompt-file [path]', 'Read run instructions from a Markdown file')
  .option('--dry-run', 'Show matched pages without calling a model')
  .option('--pull-request', 'Update the current GitHub PR or open one pull request for the run')
  .option('--project [projectId]', 'Project ID (only needed with session auth when multiple projects exist)')
  .example('holocron maintain --pull-request')
  .example('holocron maintain --since origin/main --dry-run')
  .example('holocron maintain --all --prompt-file .holocron/prompts/weekly-review.md --pull-request')
  .action(async (options, { console: output, process: proc }) => {
    if (options.prompt && options.promptFile) {
      output.error(logger.error('Use either --prompt or --prompt-file, not both.'))
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
      if (all) return !!page.prompt || !!runPrompt
      if (range && didGenerationPromptChange(repoRoot, page, range.from)) return true
      return matchChangedReferences({ references: page.references, changedFiles, changedUrls }).length > 0
    })

    output.log(logger.step(`Found ${c.bold(String(pages.length))} documentation pages`))
    output.log(logger.step(`Matched ${c.bold(String(selectedPages.length))} page${selectedPages.length === 1 ? '' : 's'}`))
    for (const page of selectedPages) output.log(`  ${page.path}`)
    if (options.dryRun || selectedPages.length === 0) return

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
      const detail = (run as { value?: { error?: string; upgradeUrl?: string } }).value
      output.error(logger.error(detail?.error ?? run.message))
      if (detail?.upgradeUrl) output.error(logger.error(`Subscribe: ${detail.upgradeUrl}`))
      return proc.exit(1)
    }

    const beforeChangedFiles = new Set(getWorkingTreeChanges(repoRoot))
    const patches = range ? getChangedPatches(repoRoot, range, changedFiles) : ''
    let runError: Error | undefined
    let reportedCostUsd = 0
    try {
      output.log(logger.step('Starting OpenCode...'))
      const result = await runOpenCode({
        repoRoot,
        pages: selectedPages,
        runPrompt,
        runPromptFile,
        changedFiles,
        patches,
        release: githubEvent?.release,
        gatewayApiKey: run.gatewayApiKey,
        providerId: run.providerId,
        modelId: run.modelId,
      })
      if (result instanceof Error) runError = result
      else reportedCostUsd = result.costUsd
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
          body: { projectId: run.projectId, keyId: run.gatewayKeyId, reportedCostUsd },
        })
        if (completed instanceof Error) runError ??= completed
      }
    }
    if (runError) {
      output.error(logger.error(runError.message))
      return proc.exit(1)
    }

    const changedPages = selectedPages.filter((page) => getWorkingTreeChanges(repoRoot).includes(page.path))
    const unexpected = getWorkingTreeChanges(repoRoot).filter((file) =>
      !beforeChangedFiles.has(file) && !selectedPages.some((page) => page.path === file),
    )
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
    if (options.pullRequest) {
      const event = githubEvent ?? manualGithubEvent(repoRoot)
      const pullRequestUrl = await publishMaintainChanges({
        repoRoot,
        files: changedPages.map((page) => page.path),
        event,
      })
      output.log(logger.success(`Pull request: ${pullRequestUrl}`))
    }
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
  if (result instanceof Error) return result
  if (result.projects.length === 1) return result.projects[0]!.projectId
  if (result.projects.length === 0) return new Error('No projects found. Create one with `holocron projects create`.')
  if (isAgent || !process.stdin.isTTY) return new Error('Multiple projects found. Pass --project <id>.')
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
  release,
  gatewayApiKey,
  providerId,
  modelId,
}: {
  repoRoot: string
  pages: MaintainPage[]
  runPrompt?: string
  runPromptFile?: string
  changedFiles: string[]
  patches: string
  release?: Record<string, unknown>
  gatewayApiKey: string
  providerId: string
  modelId: string
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
    ...pages.flatMap((page) => [
      { permission: 'edit', pattern: page.path, action: 'allow' as const },
      { permission: 'edit', pattern: page.absolutePath, action: 'allow' as const },
    ]),
    ...pages.flatMap((page) => page.references.urls.map((url) => (
      { permission: 'webfetch', pattern: url, action: 'allow' as const }
    ))),
  ]

  const previousGatewayKey = process.env.AI_GATEWAY_API_KEY
  process.env.AI_GATEWAY_API_KEY = gatewayApiKey
  const server = await createOpencodeServer({ hostname: '127.0.0.1', port: 0, timeout: 30_000, signal: controller.signal })
    .catch((error) => new Error('OpenCode server failed to start.', { cause: error }))
  if (previousGatewayKey === undefined) delete process.env.AI_GATEWAY_API_KEY
  else process.env.AI_GATEWAY_API_KEY = previousGatewayKey
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

    const system = dedent`
      You maintain documentation from versioned generation prompts.

      Review the selected MDX pages against the changed source files. The page frontmatter prompt is the original recipe used to generate that page. Re-run that recipe against the current sources while preserving correct existing content. Leave a page unchanged when the source changes do not affect it.

      First create a task list. Split independent page or reference groups into parallel tasks. Give each task exclusive ownership of its target pages. Never assign one page to two tasks. Tasks may read the repository but may only edit their assigned selected MDX pages.

      Resolve @./ and @../ references in a page prompt relative to that page. Resolve @/ references from the repository root. Resolve @https:// and @http:// URL references as remote sources. Bare URLs without @ are not references. Resolve references in a named run-instruction file relative to that instruction file, except @/ which still means the repository root.

      Update a page's frontmatter prompt when its source paths or intended coverage changed. Do not use Git or GitHub. Do not create commits. Do not edit files outside the selected pages.
    `
    const prompt = dedent`
      ## Selected pages

      ${JSON.stringify(pages.map((page) => ({ path: page.path, prompt: page.prompt, references: page.references })), null, 2)}

      ## Changed files

      ${JSON.stringify(changedFiles, null, 2)}

      ${runPrompt ? `## Run instructions${runPromptFile ? ` from ${runPromptFile}` : ''}\n\n${runPrompt}` : ''}

      ${release ? `## GitHub release\n\n${JSON.stringify(release, null, 2)}` : ''}

      ${patches ? `## Bounded source patches\n\n\`\`\`diff\n${patches}\n\`\`\`` : ''}
    `
    const result = await client.session.prompt({
      sessionID: sessionResult.data.id,
      model: { providerID: providerId, modelID: modelId },
      agent: 'build',
      system,
      tools: { bash: false, websearch: false, task: true, read: true, glob: true, grep: true, edit: true, webfetch: true },
      parts: [{ type: 'text', text: prompt }],
    })
    if (result.error || !result.data) return new Error('OpenCode failed to maintain the selected pages.')
    return { costUsd: result.data.info.cost }
  } catch (error) {
    return new Error('OpenCode maintain run failed.', { cause: error })
  } finally {
    clearTimeout(timeout)
    server.close()
  }
}

function getWorkingTreeChanges(repoRoot: string) {
  return childProcess.execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).split('\0').filter(Boolean).map((entry) => entry.slice(3).replaceAll('\\', '/'))
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

function manualGithubEvent(repoRoot: string): GithubMaintainEvent {
  const sha = childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
  const branch = childProcess.execFileSync('git', ['branch', '--show-current'], { cwd: repoRoot, encoding: 'utf8' }).trim() || 'main'
  return { runId: sha.slice(0, 12), all: false, changedUrls: [], baseBranch: branch, range: { from: sha, to: sha } }
}
