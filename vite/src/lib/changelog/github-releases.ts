/**
 * Fetch published releases from a GitHub repository.
 *
 * Two strategies, tried in order:
 *
 * 1. **`gh` CLI** — `gh api` subprocess. Handles private repos automatically
 *    via stored credentials (`gh auth login`). Skipped when `baseUrl` is set
 *    (test mock servers) or `HOLOCRON_SKIP_GH_CLI` is set.
 *
 * 2. **HTTP fetch** — direct REST API call with optional bearer token from
 *    `GH_TOKEN` / `GITHUB_TOKEN` env vars.
 *
 * Drafts are excluded, prereleases are included, sorted newest-first.
 *
 * In-memory cache (60s) prevents hammering the API on rapid dev re-syncs.
 */

import { execFile } from 'node:child_process'
import { formatHolocronWarning, logger } from '../logger.ts'

export type GitHubRelease = {
  tagName: string
  name: string | null
  body: string | null
  publishedAt: string | null
  htmlUrl: string
  prerelease: boolean
}

export type FetchReleasesResult = {
  releases: GitHubRelease[] | null
  /** User-facing diagnostic when releases is null. */
  hint: string | null
}

export type FetchReleasesOptions = {
  owner: string
  repo: string
  /** Override API origin. When set, gh CLI is skipped. */
  baseUrl?: string
  /** Auth token. Defaults to GH_TOKEN / GITHUB_TOKEN env. */
  token?: string
}

type RawRelease = {
  tag_name?: string
  name?: string | null
  body?: string | null
  published_at?: string | null
  html_url?: string
  draft?: boolean
  prerelease?: boolean
}

const PER_PAGE = 100
const CACHE_TTL_MS = 60_000
const GH_CLI_TIMEOUT_MS = 15_000

const cache: Map<string, { at: number; releases: GitHubRelease[] }> =
  ((globalThis as any).__holocron_releases_cache ??= new Map())

// ---------------------------------------------------------------------------
// gh CLI
// ---------------------------------------------------------------------------

/** Run `gh api <endpoint>` and parse stdout as JSON. Returns null on any failure. */
function execGhApi(endpoint: string): Promise<unknown | null> {
  return new Promise((resolve) => {
    execFile(
      'gh',
      ['api', endpoint],
      { timeout: GH_CLI_TIMEOUT_MS, maxBuffer: 50 * 1024 * 1024 },
      (err, stdout) => {
        if (err) return resolve(null)
        try { resolve(JSON.parse(stdout)) } catch { resolve(null) }
      },
    )
  })
}

/** Fetch all releases via `gh api`, one page at a time. */
async function tryFetchViaGhCli(owner: string, repo: string): Promise<GitHubRelease[] | null> {
  const all: RawRelease[] = []
  for (let page = 1; ; page++) {
    const raw = await execGhApi(`repos/${owner}/${repo}/releases?per_page=${PER_PAGE}&page=${page}`)
    if (!Array.isArray(raw) || raw.length === 0) {
      // First page failure means gh is unavailable or repo is inaccessible.
      if (page === 1 && raw === null) return null
      break
    }
    all.push(...raw)
    if (raw.length < PER_PAGE) break
  }
  return parseRawReleases(all, owner, repo)
}

// ---------------------------------------------------------------------------
// HTTP fetch
// ---------------------------------------------------------------------------

async function fetchViaHttp(
  owner: string,
  repo: string,
  baseUrl: string,
  token: string | undefined,
): Promise<GitHubRelease[]> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'holocron-docs',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const all: RawRelease[] = []
  for (let page = 1; ; page++) {
    const url = `${baseUrl}/repos/${owner}/${repo}/releases?per_page=${PER_PAGE}&page=${page}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      throw Object.assign(
        new Error(`GitHub API returned ${res.status} ${res.statusText} for ${url}`),
        { status: res.status },
      )
    }
    const batch = (await res.json()) as RawRelease[]
    if (!Array.isArray(batch) || batch.length === 0) break
    all.push(...batch)
    if (batch.length < PER_PAGE) break
  }
  return parseRawReleases(all, owner, repo)
}

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

function parseRawReleases(raw: RawRelease[], owner: string, repo: string): GitHubRelease[] {
  const releases: GitHubRelease[] = []
  for (const r of raw) {
    if (r.draft || !r.tag_name) continue
    releases.push({
      tagName: r.tag_name,
      name: r.name ?? null,
      body: r.body ?? null,
      publishedAt: r.published_at ?? null,
      htmlUrl: r.html_url ?? `https://github.com/${owner}/${repo}/releases/tag/${r.tag_name}`,
      prerelease: !!r.prerelease,
    })
  }
  releases.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return tb - ta
  })
  return releases
}

function hintFromStatus(status: number, owner: string, repo: string): string {
  if (status === 404) {
    return (
      `Repository "${owner}/${repo}" was not found. ` +
      'If it is private, authenticate with `gh auth login` (recommended) ' +
      'or set a `GH_TOKEN` / `GITHUB_TOKEN` environment variable with read access.'
    )
  }
  if (status === 401 || status === 403) {
    return (
      `Access denied for "${owner}/${repo}" (HTTP ${status}). ` +
      'The token may lack permissions, or you may have hit the rate limit. ' +
      'Authenticate with `gh auth login` or set `GH_TOKEN` with repo read access.'
    )
  }
  return (
    `Could not load releases from GitHub (HTTP ${status}). ` +
    'This is usually a transient issue. If the repository is private, ' +
    'authenticate with `gh auth login` or set `GH_TOKEN`.'
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch all published releases for a repository, newest-first.
 *
 * Tries `gh` CLI first (handles private repos via stored credentials),
 * falls back to HTTP. Returns `{ releases: null, hint }` on failure.
 */
export async function fetchGitHubReleases(
  options: FetchReleasesOptions,
): Promise<FetchReleasesResult> {
  const { owner, repo } = options
  const defaultBaseUrl = 'https://api.github.com'
  const baseUrl = (options.baseUrl ?? defaultBaseUrl).replace(/\/$/, '')
  const useGhCli = !options.baseUrl && !process.env.HOLOCRON_SKIP_GH_CLI

  const cacheKey = `${baseUrl}/${owner}/${repo}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { releases: cached.releases, hint: null }
  }

  // Strategy 1: gh CLI (skipped for test mocks / explicit opt-out).
  if (useGhCli) {
    const ghReleases = await tryFetchViaGhCli(owner, repo)
    if (ghReleases) {
      logger.info(`  Fetched ${ghReleases.length} releases for ${owner}/${repo} via gh CLI`)
      cache.set(cacheKey, { at: Date.now(), releases: ghReleases })
      return { releases: ghReleases, hint: null }
    }
  }

  // Strategy 2: HTTP with optional bearer token.
  // Only forward env tokens to the real GitHub API to avoid leaking secrets.
  // gh CLI convention: GH_TOKEN takes precedence over GITHUB_TOKEN.
  const token = options.token
    ?? (baseUrl === defaultBaseUrl ? process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN : undefined)

  try {
    const releases = await fetchViaHttp(owner, repo, baseUrl, token)
    logger.info(`  Fetched ${releases.length} releases for ${owner}/${repo} via HTTP`)
    cache.set(cacheKey, { at: Date.now(), releases })
    return { releases, hint: null }
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : undefined
    const hint = status
      ? hintFromStatus(status, owner, repo)
      : (
        `Failed to fetch releases for "${owner}/${repo}": ` +
        `${err instanceof Error ? err.message : String(err)}. ` +
        'If this repository is private, authenticate with `gh auth login` or set `GH_TOKEN`.'
      )
    logger.warn(formatHolocronWarning(
      `failed to fetch GitHub releases for "${owner}/${repo}": ` +
      `${err instanceof Error ? err.message : String(err)}`,
    ))
    return { releases: null, hint }
  }
}
