// Tests GitHub event ranges used to select Maintain pages, and the hidden publish commands.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import childProcess from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { parseGithubEvent, prepareMaintainBranch, readMaintainResult } from './maintain-github.ts'

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
        "baseBranch": "main",
        "changedUrls": [
          "https://github.com/owner/repo",
        ],
        "range": {
          "from": "aaa",
          "to": "bbb",
        },
        "runId": "42",
      }
    `)
  })

  test('uses the merge-base range and existing PR branch for pull requests', () => {
    expect(parseGithubEvent({
      eventName: 'pull_request',
      repository: 'owner/repo',
      runId: '43',
      payload: {
        number: 7,
        pull_request: {
          base: { ref: 'main', sha: 'base' },
          head: { ref: 'feature', sha: 'head', repo: { full_name: 'owner/repo' } },
          html_url: 'https://github.com/owner/repo/pull/7',
        },
      },
    })).toMatchInlineSnapshot(`
      {
        "all": false,
        "baseBranch": "feature",
        "changedUrls": [
          "https://github.com/owner/repo",
          "https://github.com/owner/repo/pull/7",
        ],
        "existingPullRequest": 7,
        "headBranch": "feature",
        "range": {
          "from": "base",
          "pullRequest": true,
          "to": "head",
        },
        "runId": "43",
      }
    `)
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
        "baseBranch": "master",
        "changedUrls": [],
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
        "baseBranch": "main",
        "changedUrls": [],
        "runId": "44",
      }
    `)
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
    return { repo, git, sh, stateDir: prepared.stateDir }
  }

  test('rejects a base branch that does not contain HEAD', () => {
    expect(String(setup({ localCommit: true }))).toMatchInlineSnapshot(`"Error: HEAD is not on origin/main, so a pull request into main would include unrelated commits. Check out main with fetch-depth: 0, or pass --base <branch>."`)
    expect(String(setup({ targetBranch: 'release' }))).toMatchInlineSnapshot(`"Error: HEAD is not on origin/release, so a pull request into release would include unrelated commits. Check out release with fetch-depth: 0, or pass --base <branch>."`)
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
})
