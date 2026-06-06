/**
 * Fetch GitHub repository star counts with layered caching:
 * 1. In-memory Map (1 hour TTL, instant)
 * 2. Cloudflare Cache API when available (1 hour, survives worker restarts)
 * 3. GitHub REST API fallback
 *
 * Never throws — returns null on any error so the navbar renders without stars.
 */

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const CACHE_TTL_SECONDS = 60 * 60

// ── URL parsing ──────────────────────────────────────────────────────────

export function parseGitHubRepo(url: string): { owner: string; repo: string } | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'github.com' && parsed.hostname !== 'www.github.com') {
      return null
    }
    // pathname like /owner/repo or /owner/repo/tree/main/...
    const parts = parsed.pathname.split('/').filter(Boolean) as string[]
    if (parts.length < 2) return null
    return { owner: parts[0]!, repo: parts[1]! }
  } catch {
    return null
  }
}

// ── Formatting ───────────────────────────────────────────────────────────

export function formatStarCount(count: number): string {
  if (count >= 1_000_000) {
    const m = count / 1_000_000
    return m % 1 === 0 ? `${m}m` : `${m.toFixed(1)}m`
  }
  if (count >= 1_000) {
    const k = count / 1_000
    if (count < 10_000) {
      // 1.2k, 9.9k — one decimal for < 10k
      const rounded = Math.round(k * 10) / 10
      return rounded % 1 === 0 ? `${Math.round(rounded)}k` : `${rounded}k`
    }
    return `${Math.round(k)}k`
  }
  return String(count)
}

// ── In-memory cache ──────────────────────────────────────────────────────

type CacheEntry = { stars: number; fetchedAt: number }

const memoryCache = new Map<string, CacheEntry>()

function getCacheKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase()
}

// ── Cloudflare Cache API helpers ─────────────────────────────────────────

function getCfCacheUrl(owner: string, repo: string): string {
  return `https://holocron-github-stars.internal/${owner}/${repo}`
}

async function getFromCfCache(owner: string, repo: string): Promise<number | null> {
  try {
    const cache = (globalThis as any).caches?.default as Cache | undefined
    if (!cache) return null
    const res = await cache.match(getCfCacheUrl(owner, repo))
    if (!res) return null
    const data = await res.json() as { stars: number }
    return typeof data.stars === 'number' ? data.stars : null
  } catch {
    return null
  }
}

async function putToCfCache(owner: string, repo: string, stars: number): Promise<void> {
  try {
    const cache = (globalThis as any).caches?.default as Cache | undefined
    if (!cache) return
    const url = getCfCacheUrl(owner, repo)
    const response = new Response(JSON.stringify({ stars }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    })
    await cache.put(url, response)
  } catch {
    // Cache API not available or quota exceeded; silently ignore
  }
}

// ── GitHub API fetch ─────────────────────────────────────────────────────

async function fetchFromGitHub(owner: string, repo: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        accept: 'application/vnd.github.v3+json',
        'user-agent': 'holocron-docs',
      },
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null
    const data = await res.json() as { stargazers_count?: number }
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null
  } catch {
    return null
  }
}

// ── Main entry point ─────────────────────────────────────────────────────

/**
 * Fetch the star count for a GitHub repo URL. Returns a cached value when
 * available, otherwise fetches from the GitHub API. Never throws.
 */
export async function fetchGitHubStars(url: string): Promise<number | null> {
  const repo = parseGitHubRepo(url)
  if (!repo) return null

  const key = getCacheKey(repo.owner, repo.repo)

  // 1. Check in-memory cache
  const cached = memoryCache.get(key)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.stars
  }

  // 2. Check Cloudflare Cache API
  const cfCached = await getFromCfCache(repo.owner, repo.repo)
  if (cfCached !== null) {
    memoryCache.set(key, { stars: cfCached, fetchedAt: Date.now() })
    return cfCached
  }

  // 3. Fetch from GitHub API
  const stars = await fetchFromGitHub(repo.owner, repo.repo)
  if (stars !== null) {
    memoryCache.set(key, { stars, fetchedAt: Date.now() })
    await putToCfCache(repo.owner, repo.repo, stars)
  }
  return stars
}
