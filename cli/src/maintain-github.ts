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
  defaultBranch: string
  release?: GithubMaintainRelease
}

type GithubPayload = {
  before?: string
  after?: string
  ref?: string
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
}): GithubMaintainEvent | Error {
  const repositoryUrl = `https://github.com/${repository}`
  const defaultBranch = String(payload.repository?.default_branch ?? 'main')
  if (eventName === 'push') {
    return {
      runId,
      all: false,
      range: { from: String(payload.before), to: String(payload.after) },
      changedUrls: [repositoryUrl],
      defaultBranch,
    }
  }
  // The pull_request checkout is a merge commit that is on no branch, so a maintain PR would
  // carry unrelated commits. Run maintain on pushes to the branch instead.
  if (eventName === 'pull_request' || eventName === 'pull_request_target') {
    return new Error('holocron maintain does not run on pull_request events. Run it on push to your default branch, or on a schedule.')
  }
  if (eventName === 'release') {
    const releaseUrl = String(payload.release?.html_url ?? `${repositoryUrl}/releases`)
    return {
      runId,
      all: false,
      changedUrls: [repositoryUrl, `${repositoryUrl}/releases`, releaseUrl],
      defaultBranch,
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
    defaultBranch,
  }
}

// The pull request targets the branch that is checked out: `actions/checkout` creates a local
// branch for push, workflow_dispatch, and `ref: <branch>`. A detached HEAD (tag, SHA, PR merge
// ref) falls back to the release target branch, then the repository default branch.
// prepareMaintainBranch then checks HEAD is on that branch, so a wrong guess fails early.
export function resolveBaseBranch({ repoRoot, event }: { repoRoot: string; event: GithubMaintainEvent | undefined }) {
  const current = git(repoRoot, ['branch', '--show-current'])
  if (typeof current === 'string' && current) return current
  const target = event?.release?.targetCommitish
  if (target && !/^[0-9a-f]{40}$/.test(target)) return target.replace(/^refs\/heads\//, '')
  return event?.defaultBranch ?? 'main'
}

export function loadGithubEvent(): GithubMaintainEvent | Error | undefined {
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

export const MAINTAIN_BRANCH_PREFIX = 'holocron/maintain-'
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

// Credentials the CLI uses to push and open the PR. Read before OpenCode starts, and removed
// from the OpenCode server env (see startOpencodeServer), so the model cannot push with them.
export type GithubPublishEnv = { token: string; repository: string; serverUrl: string; apiUrl?: string }

export function readGithubPublishEnv(env: NodeJS.ProcessEnv): GithubPublishEnv | Error {
  if (!env.GITHUB_TOKEN) {
    return new Error('GITHUB_TOKEN is not set. Add `env: { GITHUB_TOKEN: ${{ github.token }} }` to the maintain step.')
  }
  if (!env.GITHUB_REPOSITORY) return new Error('GITHUB_REPOSITORY is not set.')
  return {
    token: env.GITHUB_TOKEN,
    repository: env.GITHUB_REPOSITORY,
    serverUrl: env.GITHUB_SERVER_URL ?? 'https://github.com',
    apiUrl: env.GITHUB_API_URL,
  }
}

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
  if (state.targetBranch.startsWith(MAINTAIN_BRANCH_PREFIX)) {
    return new Error(`HEAD is on ${state.targetBranch}, a branch created by holocron maintain. Do not run maintain on its own branches.`)
  }
  const baseRef = `refs/remotes/origin/${state.targetBranch}`
  if (git(state.repoRoot, ['rev-parse', '--verify', '--quiet', baseRef]) instanceof Error) {
    return new Error(`origin/${state.targetBranch} is not fetched. Use actions/checkout with fetch-depth: 0.`)
  }
  if (git(state.repoRoot, ['rev-parse', '--is-shallow-repository']) === 'true') {
    return new Error('The checkout is shallow. Use actions/checkout with fetch-depth: 0.')
  }
  // The maintain branch starts at HEAD. If HEAD is not already on the base branch,
  // the pull request would carry unrelated commits.
  const onBase = git(state.repoRoot, ['merge-base', '--is-ancestor', 'HEAD', `refs/remotes/origin/${state.targetBranch}`])
  if (onBase instanceof Error) {
    return new Error(
      `HEAD is not on origin/${state.targetBranch}, so a pull request into ${state.targetBranch} would include unrelated commits. Check out the branch the pull request should target, with fetch-depth: 0.`,
      { cause: onBase },
    )
  }
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

// Checked when the model records the PR and again right before the push, so the push never
// relies on state the model reported earlier.
function checkMaintainBranch(state: MaintainState): Error | undefined {
  const branch = git(state.repoRoot, ['branch', '--show-current'])
  if (branch instanceof Error) return branch
  if (branch !== state.branch) return new Error(`HEAD is on ${branch || 'a detached commit'}. Switch back to ${state.branch}.`)
  const uncommitted = uncommittedPages(state)
  if (uncommitted instanceof Error) return uncommitted
  if (uncommitted.length > 0) return new Error(`Commit these pages first: ${uncommitted.join(', ')}`)
  if (git(state.repoRoot, ['merge-base', '--is-ancestor', state.baseSha, 'HEAD']) instanceof Error) {
    return new Error(`${state.branch} no longer starts from ${state.baseSha.slice(0, 8)}. Do not rebase or reset it.`)
  }
  const commits = git(state.repoRoot, ['rev-list', '--count', `${state.baseSha}..HEAD`])
  if (commits instanceof Error) return commits
  if (commits === '0') return new Error(`No commits on ${state.branch}. Commit the updated pages first. If no page changed, do not open a pull request.`)
  return undefined
}

export function recordMaintainResult({ stateDir, result }: { stateDir: string | undefined; result: MaintainResult }): string | Error {
  const state = readMaintainState(stateDir)
  if (state instanceof Error) return state
  if (!result.title.trim()) return new Error('Pass a non-empty --title.')
  const invalid = checkMaintainBranch(state)
  if (invalid) return invalid
  fs.writeFileSync(path.join(stateDir!, 'result.json'), JSON.stringify(result, null, 2))
  return `Recorded. Holocron pushes ${state.branch} and opens the pull request into ${state.targetBranch} after this session.`
}

export async function openMaintainPullRequest({
  state,
  publish,
  title,
  body,
}: {
  state: MaintainState
  publish: GithubPublishEnv
  title: string
  body: string
}): Promise<string | Error> {
  const invalid = checkMaintainBranch(state)
  if (invalid) return invalid
  // Push with the token explicitly, so the workflow can use persist-credentials: false and the
  // model never has git credentials. Git redacts URL credentials in its error messages.
  const remote = new URL(`/${publish.repository}.git`, publish.serverUrl)
  remote.username = 'x-access-token'
  remote.password = publish.token
  const pushed = git(state.repoRoot, ['push', remote.href, `HEAD:refs/heads/${state.branch}`])
  if (pushed instanceof Error) return pushed
  const [owner = '', repo = ''] = publish.repository.split('/')
  const octokit = new Octokit({ auth: publish.token, baseUrl: publish.apiUrl })
  const created = await octokit.rest.pulls.create({
    owner,
    repo,
    base: state.targetBranch,
    head: state.branch,
    title: title.trim(),
    body: `${body.replaceAll(MAINTAIN_PR_FOOTER, '').trim()}\n\n${MAINTAIN_PR_FOOTER}`,
  }).catch((error: Error) => error)
  if (!(created instanceof Error)) return created.data.html_url
  // Do not leave an orphan branch behind when the PR cannot be opened.
  const deleted = await octokit.rest.git.deleteRef({ owner, repo, ref: `heads/${state.branch}` }).catch((error: Error) => error)
  return new Error(
    `Could not open a pull request into ${state.targetBranch}: ${created.message}. ${deleted instanceof Error ? `The branch ${state.branch} was pushed and could not be deleted.` : `Deleted the pushed branch ${state.branch}.`} Check that the job has pull-requests: write, and that "Allow GitHub Actions to create and approve pull requests" is enabled in the repository Actions settings.`,
    { cause: created },
  )
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
