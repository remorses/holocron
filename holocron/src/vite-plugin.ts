/**
 * Holocron Vite plugin — wraps spiceflow + tailwind + tsconfig-paths.
 *
 * Usage in vite.config.ts:
 *   import { holocron } from '@holocron.so/vite/vite'
 *   export default defineConfig({ plugins: [holocron()] })
 *
 * The plugin:
 * - Reads holocron.jsonc / docs.json config
 * - Syncs MDX files + processes images at build time (sharp, image-size)
 * - Serializes the full navigation tree (with pre-processed MDX) into
 *   a virtual module — zero I/O needed at request time
 * - Wraps spiceflowPlugin with the holocron app as entry
 */

import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import type { Plugin, PluginOption, ResolvedConfig } from 'vite'
import { spiceflowPlugin } from 'spiceflow/vite'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { readConfig, resolveConfigPath, type HolocronConfig } from './config.ts'
import { syncNavigation, type SyncResult } from './lib/sync.ts'

export type HolocronPluginOptions = {
  /** Path to config file. Defaults to auto-discovery (holocron.jsonc, docs.json) */
  configPath?: string
  /** Path to pages directory. Defaults to './pages' */
  pagesDir?: string
}

const VIRTUAL_CONFIG = 'virtual:holocron-config'
const RESOLVED_CONFIG = '\0' + VIRTUAL_CONFIG

/**
 * Workaround for Vite 7 + @vitejs/plugin-rsc: the built-in vite:asset load
 * hook uses a regex that doesn't match when query params get normalized to
 * ?raw= (URLSearchParams.toString() adds the =). This plugin runs first
 * and handles ?raw imports for non-JS files explicitly.
 */
function rawImportPlugin(): Plugin {
  return {
    name: 'holocron:raw-import-fix',
    enforce: 'pre',
    load(id) {
      if (!/[?&]raw(?:=|&|$)/.test(id)) {
        return
      }
      const file = id.replace(/[?#].*$/, '')
      if (/\.[cm]?[jt]sx?$/.test(file)) {
        return
      }
      return `export default ${JSON.stringify(fs.readFileSync(file, 'utf-8'))}`
    },
  }
}

export function holocron(options: HolocronPluginOptions = {}): PluginOption {
  let root: string
  let config: HolocronConfig
  let syncResult: SyncResult
  let pagesDir: string
  let publicDirPath: string
  let distDirPath: string

  const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
  const isDev = import.meta.url.endsWith('.ts')
  const appEntry = isDev
    ? path.resolve(__dirname, 'app.tsx')
    : path.resolve(__dirname, '../src/app.tsx')

  const holocronPlugin: Plugin = {
    name: 'holocron',

    config(viteConfig) {
      root = viteConfig.root || process.cwd()
      pagesDir = options.pagesDir
        ? path.resolve(root, options.pagesDir)
        : path.resolve(root, 'pages')
    },

    async configResolved(resolved: ResolvedConfig) {
      distDirPath = resolved.build?.outDir
        ? path.resolve(root, resolved.build.outDir)
        : path.resolve(root, 'dist')

      publicDirPath = resolved.publicDir || path.resolve(root, 'public')

      config = readConfig({ root, configPath: options.configPath })

      // Sync MDX + process images at build time. The returned navigation
      // tree contains pre-processed MDX (paths rewritten, dimensions injected).
      syncResult = await syncNavigation({
        config,
        pagesDir,
        publicDir: publicDirPath,
        projectRoot: root,
        distDir: distDirPath,
      })

      console.error(
        `[holocron] synced ${syncResult.parsedCount} pages (${syncResult.cachedCount} cached)`,
      )
    },

    resolveId(id) {
      if (id === VIRTUAL_CONFIG) {
        return RESOLVED_CONFIG
      }
    },

    load(id) {
      if (id === RESOLVED_CONFIG) {
        return [
          `export const config = ${JSON.stringify(config)}`,
          `export const navigation = ${JSON.stringify(syncResult.navigation)}`,
        ].join('\n')
      }
    },

    async handleHotUpdate({ file, server }) {
      if (!file) {
        return
      }

      const isMdx = file.endsWith('.mdx') || file.endsWith('.md')
      const configFile = resolveConfigPath({ root, configPath: options.configPath })
      const isConfig = configFile && file === configFile

      if (isMdx || isConfig) {
        if (isConfig) {
          config = readConfig({ root, configPath: options.configPath })
        }
        syncResult = await syncNavigation({
          config,
          pagesDir,
          publicDir: publicDirPath,
          projectRoot: root,
          distDir: distDirPath,
        })
        const configModule = server.environments.rsc?.moduleGraph.getModuleById(RESOLVED_CONFIG)
          ?? server.environments.ssr?.moduleGraph.getModuleById(RESOLVED_CONFIG)
        if (configModule) {
          server.environments.rsc?.moduleGraph.invalidateModule(configModule)
          server.environments.ssr?.moduleGraph.invalidateModule(configModule)
        }
      }
    },
  }

  return [
    rawImportPlugin(),
    holocronPlugin,
    spiceflowPlugin({ entry: appEntry }),
    tsconfigPaths(),
    tailwindcss(),
  ]
}
