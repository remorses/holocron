// Tests GitHub event ranges and publication targets for maintain runs.

import { describe, expect, test } from 'vitest'
import { parseGithubEvent } from './maintain-github.ts'

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
