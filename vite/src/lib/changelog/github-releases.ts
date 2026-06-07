/**
 * Fetch published releases from a GitHub repository.
 *
 * Isolated from the provider so the fetch + paginate + sort logic is
 * unit-testable and so a custom `baseUrl` can be injected by tests to point
 * at a local mock server (avoids live GitHub API rate limits in CI).
 *
 * Drafts are always excluded. Prereleases are always included. Results are
 * sorted newest-first by `published_at`.
 *
 * A short in-memory cache (per process) avoids hammering the GitHub API on
 * rapid dev-server re-syncs. Build runs once so the cache is a no-op there.
 */

import { formatHolocronWarning, logger } from '../logger.ts'

/** The subset of GitHub release fields Holocron renders. */
export type GitHubRelease = {
  tagName: string
  name: string | null
  body: string | null
  publishedAt: string | null
  htmlUrl: string
  prerelease: boolean
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

const GITHUB_API_VERSION = '2022-11-28'
const PER_PAGE = 100
const CACHE_TTL_MS = 60_000

// Persist across HMR reloads so dev-server re-syncs don't hit the GitHub API
// repeatedly and trigger rate limits (60 req/hour unauthenticated).
const cache: Map<string, { at: number; releases: GitHubRelease[] }> =
  ((globalThis as any).__holocron_releases_cache ??= new Map())

export type FetchReleasesOptions = {
  owner: string
  repo: string
  /** Override the GitHub API origin (default `https://api.github.com`).
   *  Tests point this at a local mock server. */
  baseUrl?: string
  /** Auth token. Defaults to GITHUB_TOKEN / GH_TOKEN env to raise rate limits. */
  token?: string
}

/**
 * Fetch all published releases for a repository, newest-first.
 *
 * On any network/HTTP failure this logs a warning and returns `null` so the
 * caller can render a graceful "could not load releases" page instead of
 * failing the whole build on a transient GitHub outage.
 */
export async function fetchGitHubReleases(
  options: FetchReleasesOptions,
): Promise<GitHubRelease[] | null> {
  const { owner, repo } = options
  const defaultBaseUrl = 'https://api.github.com'
  const baseUrl = (options.baseUrl ?? defaultBaseUrl).replace(/\/$/, '')
  // Only forward env tokens to the real GitHub API. A custom baseUrl (e.g. a
  // test mock or a misconfigured CI override) must NOT receive the token,
  // otherwise the secret could leak to an arbitrary host.
  const token = options.token
    ?? (baseUrl === defaultBaseUrl ? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN : undefined)

  const cacheKey = `${baseUrl}/${owner}/${repo}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.releases
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
    'User-Agent': 'holocron-docs',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const releases: GitHubRelease[] = []
  try {
    for (let page = 1; ; page++) {
      const url = `${baseUrl}/repos/${owner}/${repo}/releases?per_page=${PER_PAGE}&page=${page}`
      const res = await fetch(url, { headers })
      if (!res.ok) {
        throw new Error(`GitHub API returned ${res.status} ${res.statusText} for ${url}`)
      }
      const batch = (await res.json()) as RawRelease[]
      if (!Array.isArray(batch) || batch.length === 0) break

      for (const raw of batch) {
        if (raw.draft) continue
        if (!raw.tag_name) continue
        releases.push({
          tagName: raw.tag_name,
          name: raw.name ?? null,
          body: raw.body ?? null,
          publishedAt: raw.published_at ?? null,
          htmlUrl: raw.html_url ?? `https://github.com/${owner}/${repo}/releases/tag/${raw.tag_name}`,
          prerelease: !!raw.prerelease,
        })
      }
      if (batch.length < PER_PAGE) break
    }
  } catch (err) {
    logger.warn(
      formatHolocronWarning(
        `failed to fetch GitHub releases for "${owner}/${repo}": ` +
        `${err instanceof Error ? err.message : String(err)}`,
      ),
    )
    return null
  }

  // Newest-first by published_at (releases without a date sort last).
  releases.sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return tb - ta
  })

  cache.set(cacheKey, { at: Date.now(), releases })
  return releases
}
