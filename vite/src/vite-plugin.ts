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
import { createRequire } from 'node:module'
import path from 'node:path'
import type { Plugin, PluginOption, ResolvedConfig, UserConfig } from 'vite'
import { spiceflowPlugin } from 'spiceflow/vite'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { readConfig, resolveConfigPath, type HolocronConfig } from './config.ts'
import { syncNavigation, type SyncResult } from './lib/sync.ts'
import react from '@vitejs/plugin-react'

export type HolocronPluginOptions = {
  /** Path to config file. Defaults to auto-discovery (holocron.jsonc, docs.json) */
  configPath?: string
  /** Path to pages directory. Defaults to './pages' */
  pagesDir?: string
}

const VIRTUAL_CONFIG = 'virtual:holocron-config'
const RESOLVED_CONFIG = '\0' + VIRTUAL_CONFIG

const VIRTUAL_MDX = 'virtual:holocron-mdx'
const RESOLVED_MDX = '\0' + VIRTUAL_MDX

const VIRTUAL_APP = 'virtual:holocron-app'
const RESOLVED_APP = '\0' + VIRTUAL_APP

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

type NoExternalValue = string | RegExp | true | (string | RegExp)[] | undefined

function addNoExternal(config: { resolve?: { noExternal?: NoExternalValue } }, pkg: string | RegExp) {
  config.resolve ??= {}
  const existing = config.resolve.noExternal
  const arr = Array.isArray(existing)
    ? existing
    : existing === true
      ? []
      : existing
        ? [existing]
        : []
  config.resolve.noExternal = [...arr, pkg]
}

function mergeUnique(existing: string | string[] | undefined, items: string[]): string[] {
  const arr = Array.isArray(existing) ? existing : existing ? [existing] : []
  return Array.from(new Set([...arr, ...items]))
}

export function holocron(options: HolocronPluginOptions = {}): PluginOption {
  let root: string
  let config: HolocronConfig
  let syncResult: SyncResult
  let pagesDir: string
  let publicDirPath: string
  let distDirPath: string
  let resolveHolocronPackagePath:
    | ((id: string, importer?: string, ssr?: boolean) => Promise<string | undefined>)
    | undefined

  let hasUserReactPlugin = false
  const holocronPackagePattern = /^@holocron\.so\/vite(?:\/.*)?$/

  const holocronPlugin: Plugin = {
    name: 'holocron',

    config(viteConfig) {
      root = viteConfig.root || process.cwd()
      pagesDir = options.pagesDir
        ? path.resolve(root, options.pagesDir)
        : path.resolve(root, 'pages')

      // Check if user already added a react plugin — skip ours if so
      const allPlugins = (viteConfig.plugins || []) as unknown[]
      hasUserReactPlugin = allPlugins.flat(Infinity).filter(Boolean).some((p) => {
        const name = (p as { name?: string })?.name || ''
        return name.startsWith('vite:react')
      })

      // Make spiceflow resolvable from the consumer's project root even when
      // it's only a transitive dependency of @holocron.so/vite. Without this,
      // pnpm strict hoisting prevents Vite from finding bare `spiceflow` imports.
      const _require = createRequire(import.meta.url)
      const spiceflowDir = path.dirname(_require.resolve('spiceflow/package.json'))
      const next: Pick<UserConfig, 'resolve'> = {
        resolve: {
          alias: [
            { find: /^spiceflow$/, replacement: path.join(spiceflowDir, 'dist/index.js') },
            { find: /^spiceflow\/vite$/, replacement: path.join(spiceflowDir, 'dist/vite.js') },
            { find: /^spiceflow\/react$/, replacement: path.join(spiceflowDir, 'dist/react/index.js') },
          ],
        },
      }
      return next
    },

    async configResolved(resolved: ResolvedConfig) {
      // Keep Holocron runtime subpaths looking like package imports in dev.
      // `@vitejs/plugin-rsc` only records package client sources when the
      // resolved id still includes `/node_modules/` (see `rsc:virtual-client-package`
      // in `dist/plugin.js`, around lines 879-883). If Vite realpaths these
      // imports out of `node_modules`, the markdown/sidebar client boundary stops
      // hydrating. Use a narrow resolver here instead of global
      // `resolve.preserveSymlinks`.
      const preserveSymlinkResolver = resolved.createResolver({ preserveSymlinks: true })
      resolveHolocronPackagePath = async (id, importer, ssr) => {
        return await preserveSymlinkResolver(id, importer, false, ssr)
      }

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

    async resolveId(id, importer) {
      if (
        id === '@holocron.so/vite/app-factory' ||
        id === '@holocron.so/vite/components/markdown' ||
        id === '@holocron.so/vite/styles/globals.css'
      ) {
        const resolved = await resolveHolocronPackagePath?.(
          id,
          importer,
          this.environment.name === 'ssr',
        )
        if (resolved) {
          return resolved
        }
      }
      if (id === VIRTUAL_CONFIG) {
        return RESOLVED_CONFIG
      }
      if (id === VIRTUAL_MDX) {
        return RESOLVED_MDX
      }
      if (id === VIRTUAL_APP || id.endsWith('/' + VIRTUAL_APP)) {
        return RESOLVED_APP
      }
    },

    load(id) {
      if (id === RESOLVED_CONFIG) {
        // Lightweight — no MDX content, safe for client bundle
        return [
          `export const config = ${JSON.stringify(config)}`,
          `export const navigation = ${JSON.stringify(syncResult.navigation)}`,
        ].join('\n')
      }
      if (id === RESOLVED_MDX) {
        // Server-only — pre-processed MDX content keyed by slug
        return `export default ${JSON.stringify(syncResult.mdxContent)}`
      }
      if (id === RESOLVED_APP) {
        return [
          `import { config, navigation } from '${VIRTUAL_CONFIG}'`,
          `import mdxContent from '${VIRTUAL_MDX}'`,
          `import { createHolocronApp } from '@holocron.so/vite/app-factory'`,
          `export const app = createHolocronApp({ config, navigation, mdxContent })`,
          // Auto-start the server in production (when import.meta.hot is not available).
          // In dev mode, spiceflow's SSR middleware handles requests instead.
          `if (!import.meta.hot) { app.listen(Number(process.env.PORT || 3000)) }`,
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

  // Keep Holocron's exported runtime subpaths in the RSC package-source path.
  // `@vitejs/plugin-rsc` only emits stable `client-package-proxy/...` imports
  // for package modules that stay inside the server transform pipeline, so the
  // wrapper package must be `noExternal` in `rsc`/`ssr` and excluded from the
  // client optimizer.
  const holocronRscPackagePlugin: Plugin = {
    name: 'holocron:rsc-package-source',
    configEnvironment(name, config) {
      if (name === 'client') {
        config.optimizeDeps ??= {}
        config.optimizeDeps.exclude = mergeUnique(
          config.optimizeDeps.exclude as string | string[] | undefined,
          ['@holocron.so/vite'],
        )
        config.optimizeDeps.include = mergeUnique(
          config.optimizeDeps.include as string | string[] | undefined,
          [
            '@holocron.so/vite > prismjs',
            '@holocron.so/vite > prismjs/components/prism-jsx',
            '@holocron.so/vite > prismjs/components/prism-tsx',
            '@holocron.so/vite > prismjs/components/prism-bash',
          ],
        )
      }

      if (name === 'rsc' || name === 'ssr') {
        addNoExternal(config, holocronPackagePattern)
      }
    },
  }

  return [
    rawImportPlugin(),
    holocronPlugin,
    holocronRscPackagePlugin,
    spiceflowPlugin({ entry: VIRTUAL_APP }),
    tsconfigPaths(),
    tailwindcss(),
    // Include @vitejs/plugin-react by default unless the user already
    // added their own (detected by plugin name starting with "vite:react").
    ...(hasUserReactPlugin ? [] : [react()]),
  ]
}
