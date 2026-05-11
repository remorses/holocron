// Holocron hosting worker — routes requests for *-site.holocron.so (production)
// and *-site-preview.holocron.so (preview) to deployed docs sites via Dynamic Workers.
//
// Request flow:
//   1. Extract subdomain from hostname
//   2. Look up project + deployment version + file list in D1
//   3. Try serving static assets from KV (CSS, JS, images)
//   4. Forward non-asset requests to a Dynamic Worker loaded from KV

const SITE_SUFFIX = '-site.holocron.so'
const PREVIEW_SITE_SUFFIX = '-site-preview.holocron.so'

type SiteInfo = {
  projectId: string
  version: string
  subdomain: string
  /** All file paths declared at deploy time (from deployment.files JSON column). */
  files: string[]
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

/** Query D1 for the project, its active deployment, and the declared file list.
 *  Uses raw SQL to keep the hosting worker lean (no drizzle-orm dependency). */
async function resolveSite(
  db: D1Database,
  subdomain: string,
): Promise<SiteInfo | null> {
  const row = await db
    .prepare(
      `SELECT p.project_id, d.version, d.files
       FROM project p
       JOIN deployment d ON d.id = p.current_deployment_id
       WHERE p.subdomain = ?
         AND d.status = 'active'
       LIMIT 1`,
    )
    .bind(subdomain)
    .first<{ project_id: string; version: string; files: string | null }>()

  if (!row) return null

  let files: string[] = []
  try {
    files = JSON.parse(row.files || '[]')
  } catch { /* empty */ }

  return { projectId: row.project_id, version: row.version, subdomain, files }
}

/** Try to serve a static asset (CSS, JS, images) from KV.
 *  Returns a Response on hit, null on miss. */
async function serveAsset(
  kv: KVNamespace,
  site: SiteInfo,
  request: Request,
): Promise<Response | null> {
  const url = new URL(request.url)
  const pathname = url.pathname

  // Load the asset manifest (JSON mapping path → { contentType })
  const manifestKey = `site:${site.projectId}/v:${site.version}/manifest`
  const manifestRaw = await kv.get(manifestKey, { type: 'text', cacheTtl: 300 })
  if (!manifestRaw) return null

  let manifest: Record<string, { contentType: string }>
  try {
    manifest = JSON.parse(manifestRaw)
  } catch {
    return null
  }

  const entry = manifest[pathname]
  if (!entry) return null

  const assetKey = `site:${site.projectId}/v:${site.version}/assets${pathname}`
  const content = await kv.get(assetKey, { type: 'arrayBuffer', cacheTtl: 86400 })
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

/** Load all worker modules from KV using the file list from D1 (not KV.list).
 *  Only loads JS files under the worker/ prefix. */
async function loadWorkerModules(
  kv: KVNamespace,
  site: SiteInfo,
): Promise<Record<string, string>> {
  // Dynamic Workers only accept .js and .py modules. Filter out CSS, JSON, and
  // other non-JS files that end up in the worker/ directory from the Vite build.
  const workerFiles = site.files.filter(
    (f) => f.startsWith('worker/') && (f.endsWith('.js') || f.endsWith('.mjs')),
  )
  const kvPrefix = `site:${site.projectId}/v:${site.version}/`

  const modules: Record<string, string> = {}
  await Promise.all(
    workerFiles.map(async (filePath) => {
      const content = await kv.get(kvPrefix + filePath, { type: 'text' })
      // Strip the worker/ prefix. The directory structure is preserved so
      // ssr/index.js can import ../index.js (the RSC entry).
      const moduleName = filePath.slice('worker/'.length)
      if (content && moduleName) modules[moduleName] = content
    }),
  )

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

      // 1. Resolve site from D1
      const site = await resolveSite(env.DB, subdomain)
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
      // The Cloudflare Vite plugin builds don't include a `export default { fetch }`
      // in index.js. The platform normally wraps the worker with a static asset
      // handler that delegates to the named `fetchHandler` export. For Dynamic
      // Workers we inject a thin wrapper module as the main entry that imports
      // fetchHandler from the real index.js and wires it up.
      const workerId = `${site.projectId}:v${site.version}`

      const worker = env.LOADER.get(workerId, async () => {
        const modules = await loadWorkerModules(env.SITES_KV, site)

        if (!modules['ssr/index.js']) {
          throw new Error(`No ssr/index.js found for site ${site.subdomain} v${site.version}`)
        }

        // Wrapper module that bridges the named fetchHandler export to the
        // default export shape that Dynamic Workers expect.
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
