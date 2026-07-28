/**
 * Nest the client build output under the Vite `base` path so Cloudflare Workers
 * can serve a docs site mounted on a subpath.
 *
 * Cloudflare's Asset Worker resolves a request by looking its pathname up in
 * the uploaded directory tree, and it deliberately does NOT strip Vite's
 * `base` (cloudflare/workers-sdk#11857). A site built with `base: '/docs'`
 * emits HTML referencing `/docs/assets/app.js` while the asset store holds
 * `assets/app.js`, so every script, stylesheet, font, and image 404s once
 * deployed.
 *
 * Cloudflare documents nesting files under a matching folder as the supported
 * way to serve a subdirectory. After the move, `/docs/assets/app.js` resolves
 * to `client/docs/assets/app.js` straight from the CDN, with no extra Worker
 * invocation and no `ASSETS` binding to configure.
 *
 * Node deploys never reach this code: spiceflow injects `serveStatic` with a
 * `rewriteRequestPath` that strips the base, and it only does so when the
 * Cloudflare runtime is not in use.
 */

import fs from 'node:fs'
import path from 'node:path'

/**
 * `.assetsignore` is read from the assets directory root by the Cloudflare
 * plugin, so it must stay where it was written instead of moving into the
 * nested folder.
 */
const ASSETS_IGNORE_FILE = '.assetsignore'

/** Temporary folder used to stage the move; never present in a finished build. */
const STAGING_DIR = '.holocron-base-nesting'

/**
 * Convert a resolved Vite base into the directory name the assets must live in.
 * Returns undefined for bases that must not trigger nesting: the root base and
 * absolute URL bases (`https://cdn.example.com/app/`), where assets are served
 * by something other than the Worker.
 */
export function baseToAssetsDir(base: string): string | undefined {
  if (!base.startsWith('/')) return undefined
  const dir = base.replace(/^\/+|\/+$/g, '')
  return dir || undefined
}

/**
 * Move everything in `clientOutDir` (except `.assetsignore`) into a folder
 * named after `base`. Returns the folder name when files were moved, or
 * undefined when the call was a no-op.
 *
 * Safe to call more than once: a directory that only holds `.assetsignore` and
 * the nested folder is left untouched, so repeated `writeBundle` invocations
 * cannot double-nest.
 */
export function nestClientOutputUnderBase({
  clientOutDir,
  base,
}: {
  clientOutDir: string
  base: string
}): string | undefined {
  const assetsDir = baseToAssetsDir(base)
  if (!assetsDir) return undefined
  if (!fs.existsSync(clientOutDir)) return undefined

  const movable = fs
    .readdirSync(clientOutDir)
    .filter((entry) => entry !== ASSETS_IGNORE_FILE && entry !== STAGING_DIR)

  if (movable.length === 0) return undefined

  // Already nested — the only remaining entry is the target folder itself.
  const [firstSegment] = assetsDir.split('/')
  if (movable.length === 1 && movable[0] === firstSegment) return undefined

  // Stage in a temp folder first. The base folder name can collide with an
  // existing entry (a `public/docs/` directory under `base: '/docs'`), and
  // renaming a directory onto itself would throw.
  const stagingPath = path.join(clientOutDir, STAGING_DIR)
  fs.rmSync(stagingPath, { recursive: true, force: true })
  fs.mkdirSync(stagingPath, { recursive: true })

  for (const entry of movable) {
    fs.renameSync(
      path.join(clientOutDir, entry),
      path.join(stagingPath, entry),
    )
  }

  const nestedPath = path.join(clientOutDir, assetsDir)
  fs.mkdirSync(path.dirname(nestedPath), { recursive: true })
  fs.renameSync(stagingPath, nestedPath)

  return assetsDir
}
