// Parses GitHub Actions events so Maintain can select pages from the push or schedule range,
// and publishes the maintain branch as a pull request.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import childProcess from 'node:child_process'
import { Octokit } from '@octokit/rest'
import { goke } from 'goke'

export type GithubMaintainRelease = {
  tagName?: string
  name?: string
  body?: string
  htmlUrl?: string
  publishedAt?: string
  author?: string
  targetCommitish?: string
}

export type GithubMaintainEvent = {
  runId: string
  all: boolean
  changedUrls: string[]
  range?: { from: string; to: string; pullRequest?: boolean }
  baseBranch: string
  headBranch?: string
  existingPullRequest?: number
  release?: GithubMaintainRelease
}

type GithubPayload = {
  before?: string
  after?: string
  ref?: string
  number?: number
  pull_request?: {
    base?: { ref?: string; sha?: string }
    head?: { ref?: string; sha?: string; repo?: { full_name?: string } }
    html_url?: string
  }
  release?: {
    tag_name?: string
    name?: string
    body?: string
    html_url?: string
    published_at?: string
    author?: { login?: string }
    target_commitish?: string
  }
  repository?: { default_branch?: string }
}

export function parseGithubEvent({
  eventName,
  repository,
  runId,
  payload,
}: {
  eventName: string
  repository: string
  runId: string
  payload: GithubPayload
}): GithubMaintainEvent {
  const repositoryUrl = `https://github.com/${repository}`
  const defaultBranch = String(payload.repository?.default_branch ?? 'main')
  if (eventName === 'push') {
    return {
      runId,
      all: false,
      range: { from: String(payload.before), to: String(payload.after) },
      changedUrls: [repositoryUrl],
      baseBranch: String(payload.ref ?? 'refs/heads/main').replace(/^refs\/heads\//, ''),
    }
  }
  if (eventName === 'pull_request') {
    const pullRequest = payload.pull_request
    const headRepo = pullRequest?.head?.repo?.full_name
    if (headRepo && headRepo !== repository) throw new Error('Maintain cannot update pull requests from forks.')
    return {
      runId,
      all: false,
      range: {
        from: String(pullRequest?.base?.sha),
        to: String(pullRequest?.head?.sha),
        pullRequest: true,
      },
      changedUrls: [repositoryUrl, String(pullRequest?.html_url)],
      baseBranch: String(pullRequest?.head?.ref),
      headBranch: String(pullRequest?.head?.ref),
      existingPullRequest: Number(payload.number),
    }
  }
  if (eventName === 'release') {
    const releaseUrl = String(payload.release?.html_url ?? `${repositoryUrl}/releases`)
    return {
      runId,
      all: false,
      changedUrls: [repositoryUrl, `${repositoryUrl}/releases`, releaseUrl],
      baseBranch: defaultBranch,
      release: {
        tagName: payload.release?.tag_name,
        name: payload.release?.name,
        body: payload.release?.body,
        htmlUrl: payload.release?.html_url,
        publishedAt: payload.release?.published_at,
        author: payload.release?.author?.login,
        targetCommitish: payload.release?.target_commitish,
      },
    }
  }
  return {
    runId,
    all: eventName === 'workflow_dispatch',
    changedUrls: [],
    baseBranch: defaultBranch,
  }
}

export function loadGithubEvent(): GithubMaintainEvent | undefined {
  const eventPath = process.env.GITHUB_EVENT_PATH
  const repository = process.env.GITHUB_REPOSITORY
  if (!eventPath || !repository || !process.env.GITHUB_ACTIONS) return undefined
  const payload = JSON.parse(fs.readFileSync(eventPath, 'utf8')) as GithubPayload
  return parseGithubEvent({
    eventName: process.env.GITHUB_EVENT_NAME ?? '',
    repository,
    runId: process.env.GITHUB_RUN_ID ?? process.env.GITHUB_SHA?.slice(0, 12) ?? 'manual',
    payload,
  })
}

// ── Publishing (GitHub Actions only) ─────────────────────────────────────────
// The CLI creates the maintain branch before OpenCode starts. When pages changed,
// OpenCode commits them and runs the hidden `holocron maintain-open-pr` command,
// which validates the branch and writes result.json into the state dir.
// After the session the CLI pushes and opens the PR with Octokit. No result.json
// with changed pages means the model stopped early, which fails the job.

export const MAINTAIN_STATE_DIR_ENV = 'HOLOCRON_MAINTAIN_STATE_DIR'
export const MAINTAIN_PR_FOOTER = '*PR opened by [holocron.so](https://holocron.so)*'
export const MAINTAIN_GIT_ENV = {
  GIT_AUTHOR_NAME: 'holocron.so',
  GIT_AUTHOR_EMAIL: 'bot@holocron.so',
  GIT_COMMITTER_NAME: 'holocron.so',
  GIT_COMMITTER_EMAIL: 'bot@holocron.so',
}

export type MaintainState = {
  repoRoot: string
  baseSha: string
  branch: string
  targetBranch: string
  pages: string[]
}

export type MaintainResult = { title: string; body: string }

function git(repoRoot: string, args: string[]): string | Error {
  try {
    return childProcess.execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }).trim()
  } catch (error) {
    const stderr = (error as { stderr?: string }).stderr?.trim()
    return new Error(`git ${args[0]} failed${stderr ? `: ${stderr}` : '.'}`, { cause: error })
  }
}

// Creates the branch, the state dir, and a `holocron` shim so OpenCode's bash can call the hidden commands.
export function prepareMaintainBranch({ state, binPath }: { state: MaintainState; binPath: string }) {
  const switched = git(state.repoRoot, ['switch', '-c', state.branch])
  if (switched instanceof Error) return switched
  const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-maintain-'))
  const binDir = path.join(stateDir, 'bin')
  fs.mkdirSync(binDir)
  fs.writeFileSync(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2))
  fs.writeFileSync(path.join(binDir, 'holocron'), `#!/bin/sh\nexec '${process.execPath}' '${binPath}' "$@"\n`, { mode: 0o755 })
  fs.writeFileSync(path.join(binDir, 'holocron.cmd'), `@"${process.execPath}" "${binPath}" %*\r\n`)
  return {
    stateDir,
    env: {
      ...MAINTAIN_GIT_ENV,
      [MAINTAIN_STATE_DIR_ENV]: stateDir,
      PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  }
}

export function readMaintainResult(stateDir: string): MaintainResult | undefined {
  const file = path.join(stateDir, 'result.json')
  if (!fs.existsSync(file)) return undefined
  return JSON.parse(fs.readFileSync(file, 'utf8')) as MaintainResult
}

function readMaintainState(stateDir: string | undefined): MaintainState | Error {
  const file = stateDir && path.join(stateDir, 'state.json')
  if (!file || !fs.existsSync(file)) {
    return new Error('This command only works inside `holocron maintain` in GitHub Actions.')
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as MaintainState
}

function uncommittedPages(state: MaintainState) {
  const changed = git(state.repoRoot, ['diff', '--name-only', '-z', 'HEAD', '--', ...state.pages])
  if (changed instanceof Error) return changed
  return changed.split('\0').filter(Boolean)
}

export function recordMaintainResult({ stateDir, result }: { stateDir: string | undefined; result: MaintainResult }): string | Error {
  const state = readMaintainState(stateDir)
  if (state instanceof Error) return state
  if (!result.title.trim()) return new Error('Pass a non-empty --title.')
  const branch = git(state.repoRoot, ['branch', '--show-current'])
  if (branch instanceof Error) return branch
  if (branch !== state.branch) return new Error(`HEAD is on ${branch || 'a detached commit'}. Switch back to ${state.branch}.`)
  const uncommitted = uncommittedPages(state)
  if (uncommitted instanceof Error) return uncommitted
  if (uncommitted.length > 0) return new Error(`Commit these pages first: ${uncommitted.join(', ')}`)
  const commits = git(state.repoRoot, ['rev-list', '--count', `${state.baseSha}..HEAD`])
  if (commits instanceof Error) return commits
  if (commits === '0') return new Error(`No commits on ${state.branch}. Commit the updated pages first. If no page changed, do not open a pull request.`)
  fs.writeFileSync(path.join(stateDir!, 'result.json'), JSON.stringify(result, null, 2))
  return `Recorded. Holocron pushes ${state.branch} and opens the pull request into ${state.targetBranch} after this session.`
}

export async function openMaintainPullRequest({
  state,
  title,
  body,
}: {
  state: MaintainState
  title: string
  body: string
}): Promise<string | Error> {
  const pushed = git(state.repoRoot, ['push', 'origin', `HEAD:refs/heads/${state.branch}`])
  if (pushed instanceof Error) return pushed
  const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? '').split('/')
  if (!owner || !repo) return new Error('GITHUB_REPOSITORY is not set.')
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN, baseUrl: process.env.GITHUB_API_URL })
  const created = await octokit.rest.pulls.create({
    owner,
    repo,
    base: state.targetBranch,
    head: state.branch,
    title: title.trim(),
    body: `${body.replaceAll(MAINTAIN_PR_FOOTER, '').trim()}\n\n${MAINTAIN_PR_FOOTER}`,
  }).catch((error: Error) => new Error(
    `Pushed ${state.branch} but could not open a pull request into ${state.targetBranch}: ${error.message}. If GitHub Actions is not permitted to create pull requests, enable "Allow GitHub Actions to create and approve pull requests" in the repository Actions settings.`,
    { cause: error },
  ))
  if (created instanceof Error) return created
  return created.data.html_url
}

export const maintainPublishCli = goke()

// The body comes from stdin: bullet bodies start with "-", which the flag parser reads as options.
maintainPublishCli
  .command('maintain-open-pr', 'Used by holocron maintain in GitHub Actions: record the pull request for the committed pages')
  .hidden()
  .option('--title <title>', 'Pull request title')
  .example(`holocron maintain-open-pr --title "[holocron] Update docs" <<'EOF'\n- Document the new flag\nEOF`)
  .action((options, { console: output, process: proc }) => {
    const body = process.stdin.isTTY ? '' : fs.readFileSync(0, 'utf8')
    const recorded = body.trim()
      ? recordMaintainResult({
        stateDir: process.env[MAINTAIN_STATE_DIR_ENV],
        result: { title: options.title ?? '', body },
      })
      : new Error('Pass the pull request body on stdin with a heredoc.')
    if (recorded instanceof Error) {
      output.error(recorded.message)
      return proc.exit(1)
    }
    output.log(recorded)
  })
