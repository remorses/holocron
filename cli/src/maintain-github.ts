// Parses GitHub Actions events so Maintain can select pages from the push or schedule range.

import fs from 'node:fs'

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
      baseBranch: String(payload.repository?.default_branch ?? 'main'),
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
    baseBranch: 'main',
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
