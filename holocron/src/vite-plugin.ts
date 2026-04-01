/**
 * Holocron Vite plugin — wraps spiceflow + tailwind + tsconfig-paths.
 *
 * Usage in vite.config.ts:
 *   import { holocron } from '@holocron.so/vite/vite'
 *   export default defineConfig({ plugins: [holocron()] })
 *
 * The plugin:
 * - Reads holocron.jsonc / docs.json config
 * - Syncs MDX files to enriched navigation tree (with SHA-based caching)
 * - Generates virtual modules for page loaders and config
 * - Wraps spiceflowPlugin with the holocron app as entry
 * - Registers tailwind and tsconfig-paths plugins
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
import type { Navigation } from './navigation.ts'

export type HolocronPluginOptions = {
  /** Path to config file. Defaults to auto-discovery (holocron.jsonc, docs.json) */
  configPath?: string
  /** Path to pages directory. Defaults to './pages' */
  pagesDir?: string
}

const VIRTUAL_PAGES = 'virtual:holocron-pages'
const VIRTUAL_CONFIG = 'virtual:holocron-config'
const RESOLVED_PAGES = '\0' + VIRTUAL_PAGES
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

  // Resolve the holocron app entry — always points to source app.tsx
  // because Vite needs to process JSX, CSS imports, and virtual modules.
  // In dev (tsx): import.meta.url ends with .ts, app.tsx is a sibling.
  // In compiled (dist/): import.meta.url ends with .js, app.tsx is in ../src/.
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

    configResolved(resolved: ResolvedConfig) {
      distDirPath = resolved.build?.outDir
        ? path.resolve(root, resolved.build.outDir)
        : path.resolve(root, 'dist')

      publicDirPath = resolved.publicDir || path.resolve(root, 'public')

      // Read config
      config = readConfig({ root, configPath: options.configPath })

      // Sync MDX → navigation tree (with SHA caching from dist/)
      // Also copies relative images to public/_holocron/images/
      syncResult = syncNavigation({
        config,
        pagesDir,
        publicDir: publicDirPath,
        distDir: distDirPath,
      })

      console.error(
        `[holocron] synced ${syncResult.parsedCount} pages (${syncResult.cachedCount} cached)`,
      )
    },

    resolveId(id) {
      if (id === VIRTUAL_PAGES) {
        return RESOLVED_PAGES
      }
      if (id === VIRTUAL_CONFIG) {
        return RESOLVED_CONFIG
      }
    },

    load(id) {
      if (id === RESOLVED_PAGES) {
        // Generate the import.meta.glob call for the user's pages directory
        // Path must be relative to root for Vite's glob to work
        const relPagesDir = path.relative(root, pagesDir).replace(/\\/g, '/')
        return `export const pages = import.meta.glob('/${relPagesDir}/**/*.{mdx,md}', { query: '?raw', import: 'default' })`
      }

      if (id === RESOLVED_CONFIG) {
        // Serialize config, navigation, and pagesDir prefix into the virtual module.
        // pagesDir prefix is needed so loadMdxContent can match glob keys correctly
        // regardless of the user's pagesDir setting.
        const relPagesDir = path.relative(root, pagesDir).replace(/\\/g, '/')
        return [
          `export const config = ${JSON.stringify(config)}`,
          `export const navigation = ${JSON.stringify(syncResult.navigation)}`,
          `export const pagesDirPrefix = ${JSON.stringify('/' + relPagesDir)}`,
        ].join('\n')
      }
    },

    handleHotUpdate({ file, server }) {
      // Re-sync when MDX files or config changes
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
        syncResult = syncNavigation({
          config,
          pagesDir,
          publicDir: publicDirPath,
          distDir: distDirPath,
        })
        // Invalidate virtual modules so the app picks up changes
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
