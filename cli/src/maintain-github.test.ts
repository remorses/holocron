// Tests GitHub event ranges used to select Maintain pages, and the hidden publish commands.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import childProcess from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { openMaintainPullRequest, parseGithubEvent, prepareMaintainBranch, readGithubPublishEnv, readMaintainResult, resolveBaseBranch } from './maintain-github.ts'

describe('maintain GitHub events', () => {
  test('uses the exact before and after range for pushes', () => {
    expect(parseGithubEvent({
      eventName: 'push',
      repository: 'owner/repo',
      runId: '42',
      payload: { before: 'aaa', after: 'bbb', ref: 'refs/heads/main' },
    })).toMatchInlineSnapshot(`
      {
        "all": false,
        "changedUrls": [
          "https://github.com/owner/repo",
        ],
        "defaultBranch": "main",
        "range": {
          "from": "aaa",
          "to": "bbb",
        },
        "runId": "42",
      }
    `)
  })

  test('rejects pull_request events', () => {
    expect(String(parseGithubEvent({ eventName: 'pull_request', repository: 'owner/repo', runId: '43', payload: {} }))).toMatchInlineSnapshot(`"Error: holocron maintain does not run on pull_request events. Run it on push to your default branch, or on a schedule."`)
  })

  test('targets the repository default branch on schedules', () => {
    expect(parseGithubEvent({
      eventName: 'schedule',
      repository: 'owner/repo',
      runId: '45',
      payload: { repository: { default_branch: 'master' } },
    })).toMatchInlineSnapshot(`
      {
        "all": false,
        "changedUrls": [],
        "defaultBranch": "master",
        "runId": "45",
      }
    `)
  })

  test('runs all pages for workflow dispatch', () => {
    expect(parseGithubEvent({
      eventName: 'workflow_dispatch',
      repository: 'owner/repo',
      runId: '44',
      payload: {},
    })).toMatchInlineSnapshot(`
      {
        "all": true,
        "changedUrls": [],
        "defaultBranch": "main",
        "runId": "44",
      }
    `)
  })
})

describe('resolveBaseBranch', () => {
  test('uses the checked-out branch, else the release target, else the default branch', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-base-'))
    const git = (...args: string[]) => childProcess.execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
    git('init', '-q', '-b', 'docs')
    git('-c', 'user.name=a', '-c', 'user.email=a@a', 'commit', '-q', '--allow-empty', '-m', 'init')
    const event = { runId: '1', all: false, changedUrls: [], defaultBranch: 'main' }
    const release = { ...event, release: { targetCommitish: 'release/2.x' } }
    const releaseSha = { ...event, release: { targetCommitish: git('rev-parse', 'HEAD') } }
    const onBranch = resolveBaseBranch({ repoRoot: repo, event: release })
    git('checkout', '-q', '--detach')
    expect({
      onBranch,
      detached: resolveBaseBranch({ repoRoot: repo, event }),
      detachedRelease: resolveBaseBranch({ repoRoot: repo, event: release }),
      detachedReleaseSha: resolveBaseBranch({ repoRoot: repo, event: releaseSha }),
      noEvent: resolveBaseBranch({ repoRoot: repo, event: undefined }),
    }).toMatchInlineSnapshot(`
      {
        "detached": "main",
        "detachedRelease": "release/2.x",
        "detachedReleaseSha": "main",
        "noEvent": "main",
        "onBranch": "docs",
      }
    `)
    fs.rmSync(repo, { recursive: true, force: true })
  })
})

const OPEN_PR = `holocron maintain-open-pr --title "[holocron] Update page" <<'EOF'\n- change\nEOF`

describe('maintain publish commands', () => {
  function setup({ targetBranch = 'main', localCommit = false } = {}) {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-publish-'))
    const git = (...args: string[]) => childProcess.execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim()
    git('init', '-b', 'main')
    git('config', 'user.name', 'someone')
    git('config', 'user.email', 'someone@example.com')
    fs.writeFileSync(path.join(repo, 'page.mdx'), 'old\n')
    git('add', '.')
    git('commit', '-m', 'init')
    childProcess.execFileSync('git', ['init', '--bare', '-b', 'main', `${repo}.git`])
    git('remote', 'add', 'origin', `${repo}.git`)
    git('push', '-q', 'origin', 'main')
    git('fetch', '-q', 'origin')
    if (localCommit) git('commit', '-q', '--allow-empty', '-m', 'not on origin')
    const prepared = prepareMaintainBranch({
      state: { repoRoot: repo, baseSha: git('rev-parse', 'HEAD'), branch: 'holocron/maintain-1', targetBranch, pages: ['page.mdx'] },
      // Node 24 strips types, so the shim can run the TypeScript entry directly.
      binPath: fileURLToPath(new URL('./bin.ts', import.meta.url)),
    })
    if (prepared instanceof Error) return prepared
    // Same shell environment OpenCode's bash tool gets: `holocron` resolves through the shim on PATH.
    const sh = (command: string) => {
      const out = childProcess.spawnSync('sh', ['-c', command], { cwd: repo, encoding: 'utf8', env: { ...process.env, ...prepared.env } })
      return `exit ${out.status}: ${(out.stdout + out.stderr).trim()}`
    }
    return { repo, git, sh, stateDir: prepared.stateDir, state: { repoRoot: repo, baseSha: git('rev-parse', 'main'), branch: 'holocron/maintain-1', targetBranch, pages: ['page.mdx'] } }
  }

  test('rejects a base branch that does not contain HEAD', () => {
    expect(String(setup({ localCommit: true }))).toMatchInlineSnapshot(`"Error: HEAD is not on origin/main, so a pull request into main would include unrelated commits. Check out the branch the pull request should target, with fetch-depth: 0."`)
    expect(String(setup({ targetBranch: 'holocron/maintain-9' }))).toMatchInlineSnapshot(`"Error: HEAD is on holocron/maintain-9, a branch created by holocron maintain. Do not run maintain on its own branches."`)
    expect(String(setup({ targetBranch: 'release' }))).toMatchInlineSnapshot(`"Error: origin/release is not fetched. Use actions/checkout with fetch-depth: 0."`)
  })

  test('open-pr requires committed pages, then records the pull request', () => {
    const prepared = setup()
    if (prepared instanceof Error) throw prepared
    const { repo, git, sh, stateDir } = prepared
    expect(git('branch', '--show-current')).toMatchInlineSnapshot(`"holocron/maintain-1"`)
    expect(sh(OPEN_PR)).toMatchInlineSnapshot(`"exit 1: No commits on holocron/maintain-1. Commit the updated pages first. If no page changed, do not open a pull request."`)
    fs.writeFileSync(path.join(repo, 'page.mdx'), 'new\n')
    expect(sh(OPEN_PR)).toMatchInlineSnapshot(`"exit 1: Commit these pages first: page.mdx"`)
    expect(readMaintainResult(stateDir)).toMatchInlineSnapshot(`undefined`)
    expect(sh('git add page.mdx && git commit -q -m "Update page" && git log -1 --format="%an <%ae>"')).toMatchInlineSnapshot(`"exit 0: holocron.so <bot@holocron.so>"`)
    expect(sh(OPEN_PR)).toMatchInlineSnapshot(`"exit 0: Recorded. Holocron pushes holocron/maintain-1 and opens the pull request into main after this session."`)
    expect(readMaintainResult(stateDir)).toMatchInlineSnapshot(`
      {
        "body": "- change
      ",
        "title": "[holocron] Update page",
      }
    `)
  })

  test('pushes with the token URL, then deletes the branch when the PR cannot be opened', async () => {
    const prepared = setup()
    if (prepared instanceof Error) throw prepared
    const { repo, sh, state } = prepared
    const publish = { token: 't', repository: `${repo.slice(1)}`, serverUrl: 'file:///', apiUrl: 'http://127.0.0.1:9' }
    expect(String(await openMaintainPullRequest({ state, publish, title: 't', body: 'b' }))).toMatchInlineSnapshot(`"Error: No commits on holocron/maintain-1. Commit the updated pages first. If no page changed, do not open a pull request."`)
    fs.writeFileSync(path.join(repo, 'page.mdx'), 'new\n')
    sh('git commit -q -am "Update page"')
    const result = await openMaintainPullRequest({ state, publish, title: 't', body: 'b' })
    expect(String(result).replace(/into main: .*? The branch/, 'into main: <network error>. The branch')).toMatchInlineSnapshot(`"Error: Could not open a pull request into main: <network error>. The branch holocron/maintain-1 was pushed and could not be deleted. Check that the job has pull-requests: write, and that "Allow GitHub Actions to create and approve pull requests" is enabled in the repository Actions settings."`)
    expect(sh(`git ls-remote ${repo}.git 'refs/heads/holocron/*'`).replace(/[0-9a-f]{40}/, '<sha>')).toMatchInlineSnapshot(`"exit 0: <sha>	refs/heads/holocron/maintain-1"`)
  })
})

test('readGithubPublishEnv requires GITHUB_TOKEN', () => {
  expect(String(readGithubPublishEnv({ GITHUB_REPOSITORY: 'o/r' }))).toMatchInlineSnapshot(`"Error: GITHUB_TOKEN is not set. Add \`env: { GITHUB_TOKEN: \${{ github.token }} }\` to the maintain step."`)
  expect(readGithubPublishEnv({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' })).toMatchInlineSnapshot(`
    {
      "apiUrl": undefined,
      "repository": "o/r",
      "serverUrl": "https://github.com",
      "token": "t",
    }
  `)
})
