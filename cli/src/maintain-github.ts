// Parses GitHub events and publishes validated documentation changes with REST.

import fs from 'node:fs'
import path from 'node:path'

export type GithubMaintainEvent = {
  runId: string
  all: boolean
  changedUrls: string[]
  range?: { from: string; to: string; pullRequest?: boolean }
  baseBranch: string
  headBranch?: string
  existingPullRequest?: number
  release?: Record<string, unknown>
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

async function githubRequest<T>({
  repository,
  token,
  route,
  method = 'GET',
  body,
  allowNotFound,
}: {
  repository: string
  token: string
  route: string
  method?: string
  body?: unknown
  allowNotFound?: boolean
}): Promise<T | undefined> {
  const response = await fetch(`https://api.github.com/repos/${repository}${route}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (allowNotFound && response.status === 404) return undefined
  if (!response.ok) throw new Error(`GitHub ${method} ${route} failed (${response.status}): ${await response.text()}`)
  return await response.json() as T
}

function refRoute(branch: string) {
  return `/git/ref/heads/${branch.split('/').map(encodeURIComponent).join('/')}`
}

export async function publishMaintainChanges({
  repoRoot,
  files,
  event,
}: {
  repoRoot: string
  files: string[]
  event: GithubMaintainEvent
}) {
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN
  if (!repository || !token) throw new Error('--pull-request requires GITHUB_REPOSITORY and GITHUB_TOKEN.')

  const branch = event.headBranch ?? `holocron/maintain/${event.runId}`
  const existingRef = await githubRequest<{ object: { sha: string } }>({
    repository,
    token,
    route: refRoute(branch),
    allowNotFound: true,
  })
  const baseSha = existingRef?.object.sha ?? event.range?.to ?? process.env.GITHUB_SHA
  if (!baseSha) throw new Error('Could not determine the GitHub commit for the maintain branch.')

  const commit = await githubRequest<{ tree: { sha: string } }>({
    repository,
    token,
    route: `/git/commits/${baseSha}`,
  })
  const treeEntries = await Promise.all(files.map(async (file) => {
    const blob = await githubRequest<{ sha: string }>({
      repository,
      token,
      route: '/git/blobs',
      method: 'POST',
      body: { content: fs.readFileSync(path.join(repoRoot, file), 'base64'), encoding: 'base64' },
    })
    return { path: file, mode: '100644', type: 'blob', sha: blob!.sha }
  }))
  const tree = await githubRequest<{ sha: string }>({
    repository,
    token,
    route: '/git/trees',
    method: 'POST',
    body: { base_tree: commit!.tree.sha, tree: treeEntries },
  })
  const nextCommit = await githubRequest<{ sha: string }>({
    repository,
    token,
    route: '/git/commits',
    method: 'POST',
    body: {
      message: 'Maintain documentation from changed sources',
      tree: tree!.sha,
      parents: [baseSha],
    },
  })

  if (existingRef) {
    await githubRequest({
      repository,
      token,
      route: refRoute(branch),
      method: 'PATCH',
      body: { sha: nextCommit!.sha, force: false },
    })
  } else {
    await githubRequest({
      repository,
      token,
      route: '/git/refs',
      method: 'POST',
      body: { ref: `refs/heads/${branch}`, sha: nextCommit!.sha },
    })
  }

  if (event.existingPullRequest) {
    return `https://github.com/${repository}/pull/${event.existingPullRequest}`
  }

  const owner = repository.split('/')[0]
  const openPulls = await githubRequest<Array<{ html_url: string }>>({
    repository,
    token,
    route: `/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}&base=${encodeURIComponent(event.baseBranch)}`,
  })
  if (openPulls?.[0]) return openPulls[0].html_url

  const pullRequest = await githubRequest<{ html_url: string }>({
    repository,
    token,
    route: '/pulls',
    method: 'POST',
    body: {
      title: 'Maintain documentation from changed sources',
      head: branch,
      base: event.baseBranch,
      body: `Holocron reviewed generation prompts and updated ${files.length} documentation file${files.length === 1 ? '' : 's'}.`,
    },
  })
  return pullRequest!.html_url
}
