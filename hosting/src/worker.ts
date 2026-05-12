// Holocron hosting worker — routes requests for *-site.holocron.so (production)
// and *-site-preview.holocron.so (preview) to deployed docs sites via Dynamic Workers.
//
// Content-addressable storage: file content is stored at "blob:{sha256hex}" keys.
// Site resolution + manifest is a single KV read at "site-info:{subdomain}".
// The manifest maps file paths to content hashes so the worker can resolve them.
//
// Request flow:
//   1. Extract subdomain from hostname
//   2. Read site-info (includes manifest) from KV — single read per request
//   3. Try serving static assets from blob:{hash} keys
//   4. Forward non-asset requests to a Dynamic Worker loaded from blob:{hash} keys
//
// Performance: site-info uses KV (globally replicated, ~1-5ms reads) with 30s
// cacheTtl. Blob reads use 86400s cacheTtl since content hashes are immutable.
// Dynamic Workers are cached by env.LOADER.get(workerId) across requests.

import { env } from 'cloudflare:workers'

const SITE_SUFFIX = '-site.holocron.so'
const PREVIEW_SITE_SUFFIX = '-site-preview.holocron.so'

/** Manifest maps file paths to content hashes (+ contentType for assets).
 *  Embedded in site-info so the hosting worker needs only one KV read. */
type Manifest = Record<string, { hash: string; contentType?: string }>

type SiteInfo = {
  projectId: string
  version: string
  subdomain: string
  manifest: Manifest
}

/** Extract the subdomain from the request hostname.
 *  Matches both *-site.holocron.so and *-site-preview.holocron.so. */
function extractSubdomain(hostname: string): string | undefined {
  // Check preview first (longer suffix, more specific)
  if (hostname.endsWith(PREVIEW_SITE_SUFFIX)) {
    return hostname.slice(0, -PREVIEW_SITE_SUFFIX.length) || undefined
  }
  if (hostname.endsWith(SITE_SUFFIX)) {
    return hostname.slice(0, -SITE_SUFFIX.length) || undefined
  }
  return undefined
}

/** Resolve site info from KV. Written at deploy finalize time.
 *  KV reads are ~1-5ms globally (replicated to all datacenters).
 *  Uses raw SQL to keep the hosting worker lean (no drizzle-orm dependency). */
async function resolveSite(
  subdomain: string,
): Promise<SiteInfo | null> {
  // KV cacheTtl minimum is 30 seconds (Cloudflare enforced).
  const kvData = await env.SITES_KV.get(`site-info:${subdomain}`, { type: 'text', cacheTtl: 30 })
  if (!kvData) return null

  try {
    const parsed = JSON.parse(kvData) as { projectId: string; version: string; manifest: Manifest }
    return { projectId: parsed.projectId, version: parsed.version, subdomain, manifest: parsed.manifest }
  } catch {
    return null
  }
}

/** Try to serve a static asset (CSS, JS, images) from KV.
 *  Resolves file paths via the manifest → content-addressed blob:{hash} keys.
 *  Returns a Response on hit, null on miss. */
async function serveAsset(
  kv: KVNamespace,
  site: SiteInfo,
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url)
  const pathname = url.pathname

  // The manifest maps "assets/..." paths. Browser requests "/assets/style.css",
  // the manifest key is "assets/assets/style.css" (CLI prefix convention).
  const manifestKey = `assets${pathname}`
  const entry = site.manifest[manifestKey]
  if (!entry || !entry.contentType) return null

  // Content-addressed: load from blob:{hash}
  const content = await kv.get(`blob:${entry.hash}`, { type: 'arrayBuffer', cacheTtl: 86400 })
  if (!content) return null

  // Content-hashed filenames (e.g. style-abc123.css) are immutable.
  // Stable paths (favicon.ico, robots.txt, logo.svg) get short TTLs
  // so redeployments are picked up without a year-long browser cache.
  const isHashed = /\.[a-f0-9]{6,}\./i.test(pathname)

  return new Response(content, {
    headers: {
      'Content-Type': entry.contentType,
      'Cache-Control': isHashed
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=60, s-maxage=300',
    },
  })
}

/** Load all worker modules from KV via manifest → blob:{hash} lookups.
 *  Only loads JS files under the worker/ prefix. */
async function loadWorkerModules(
  kv: KVNamespace,
  site: SiteInfo,
): Promise<Record<string, string>> {
  // Dynamic Workers only accept .js and .py modules. Filter out CSS, JSON, and
  // other non-JS files that end up in the worker/ directory from the Vite build.
  const workerEntries = Object.entries(site.manifest).filter(
    ([path]) => path.startsWith('worker/') && (path.endsWith('.js') || path.endsWith('.mjs')),
  )

  // Deduplicate blob reads: multiple file paths can share the same content
  // hash (e.g. empty shim modules). Read each unique hash once.
  const uniqueHashes = [...new Set(workerEntries.map(([, e]) => e.hash))]
  const blobMap = new Map<string, string>()
  await Promise.all(
    uniqueHashes.map(async (hash) => {
      const content = await kv.get(`blob:${hash}`, { type: 'text', cacheTtl: 86400 })
      if (content) blobMap.set(hash, content)
    }),
  )

  const modules: Record<string, string> = {}
  for (const [filePath, entry] of workerEntries) {
    const moduleName = filePath.slice('worker/'.length)
    const content = blobMap.get(entry.hash)
    if (content && moduleName) {
      modules[moduleName] = content
    }
  }

  return modules
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url)
      const subdomain = extractSubdomain(url.hostname)

      if (!subdomain) {
        return new Response('Not found', { status: 404 })
      }

      // 1. Resolve site from KV (fast, D1 fallback for legacy)
      const site = await resolveSite(subdomain)
      if (!site) {
        return new Response(
          `Site "${subdomain}" not found. Deploy with \`holocron deploy\`.`,
          { status: 404, headers: { 'Content-Type': 'text/plain' } },
        )
      }

      // 2. Try static asset first (fast path, no Dynamic Worker needed)
      const assetResponse = await serveAsset(env.SITES_KV, site, request)
      if (assetResponse) return assetResponse

      // 3. Forward to Dynamic Worker
      //
      // Use the SSR entrypoint for hosted docs. The RSC root module is still
      // uploaded because SSR imports it while rendering, but making SSR the
      // main Dynamic Worker module avoids running Node-only app.listen guards
      // from the RSC entry during worker startup.
      const workerId = `${site.projectId}:v${site.version}`

      const worker = env.LOADER.get(workerId, async () => {
        const modules = await loadWorkerModules(env.SITES_KV, site)

        if (!modules['ssr/index.js']) {
          throw new Error(`No ssr/index.js found for site ${site.subdomain} v${site.version}`)
        }

        const wrapperJs = [
          `import { fetchHandler } from "./ssr/index.js";`,
          `export default {`,
          `  async fetch(request, env, ctx) {`,
          `    return fetchHandler(request, env, ctx);`,
          `  }`,
          `};`,
        ].join('\n')

        // TODO: add sandbox limits to prevent billing abuse and outbound DDoS:
        //   globalOutbound: null,  // or a controlled Fetcher that rate-limits
        //   limits: { cpuMs: 50, subRequests: 20 },
        // Currently left at defaults because docs sites need outbound fetches
        // (Google Fonts, remote images, OG images, AI chat proxy).
        return {
          compatibilityDate: '2026-05-11',
          compatibilityFlags: ['nodejs_compat'],
          mainModule: '__dw_entry.js',
          modules: {
            '__dw_entry.js': wrapperJs,
            ...modules,
          },
        }
      })

      return worker.getEntrypoint().fetch(request)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const stack = err instanceof Error ? err.stack : ''
      return new Response(`Internal error: ${message}\n\n${stack}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })
    }
  },
} satisfies ExportedHandler<Env>
