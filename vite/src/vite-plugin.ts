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

  /** Resolved absolute path to the config file (holocron.jsonc or docs.json) */
  let configFilePath: string | undefined

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
      configFilePath = resolveConfigPath({ root, configPath: options.configPath })

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
        // Register the config file as a dependency so it enters the module
        // graph. When the file changes, Vite associates the change with this
        // virtual module — @tailwindcss/vite sees a JS module in ctx.modules
        // and skips its full-reload, and @vitejs/plugin-rsc handles the HMR
        // via rsc:update automatically.
        if (configFilePath) {
          this.addWatchFile(configFilePath)
        }
        return [
          `export const config = ${JSON.stringify(config)}`,
          `export const navigation = ${JSON.stringify(syncResult.navigation)}`,
        ].join('\n')
      }
      if (id === RESOLVED_MDX) {
        // Register every known MDX file as a dependency so edits to existing
        // pages flow through the module graph (same mechanism as config above).
        // New MDX files that don't exist yet are handled separately in hotUpdate.
        for (const slug of Object.keys(syncResult.mdxContent)) {
          for (const ext of ['.mdx', '.md']) {
            const mdxPath = path.join(pagesDir, slug + ext)
            if (fs.existsSync(mdxPath)) {
              this.addWatchFile(mdxPath)
            }
          }
        }
        return `export default ${JSON.stringify(syncResult.mdxContent)}`
      }
      if (id === RESOLVED_APP) {
        return [
          `import { createHolocronApp } from '@holocron.so/vite/app-factory'`,
          `export const app = createHolocronApp()`,
          // Auto-start the server in production (when import.meta.hot is not available).
          // In dev mode, spiceflow's SSR middleware handles requests instead.
          `if (!import.meta.hot) { app.listen(Number(process.env.PORT || 3000)) }`,
        ].join('\n')
      }
    },

    configureServer(server) {
      // Config file is read with fs.readFileSync (not imported), so Vite
      // wouldn't watch it by default. addWatchFile in load() registers it
      // as a dependency of the virtual module, but the file must also be
      // watched by chokidar to trigger change events.
      if (configFilePath) {
        server.watcher.add(configFilePath)
      }
    },

    // hotUpdate — per-environment HMR hook.
    //
    // addWatchFile in load() puts our virtual module in ctx.modules for
    // existing files, so @tailwindcss/vite sees a JS module and skips its
    // full-reload. For new/deleted MDX files, we inject virtual modules
    // into ctx.modules (same pattern as vite:import-glob).
    //
    // We return [] in ALL environments because ctx.modules also contains
    // the raw .mdx/.jsonc file entries which the RSC plugin would try to
    // transformRequest as JS and fail. Instead we invalidate the virtual
    // modules ourselves and send rsc:update manually.
    async hotUpdate(ctx) {
      const isMdx = ctx.file.endsWith('.mdx') || ctx.file.endsWith('.md')
      const isConfig = configFilePath && ctx.file === configFilePath

      if (!isMdx && !isConfig) {
        return
      }

      // For new/deleted MDX files (type !== "update"), the file isn't
      // registered via addWatchFile yet so our virtual modules won't be
      // in ctx.modules. Inject them — mirroring how vite:import-glob
      // adds glob-owning modules on create/delete. This makes downstream
      // plugins (Tailwind) see a JS module and skip their full-reload.
      if (ctx.type !== 'update' && isMdx && ctx.file.startsWith(pagesDir)) {
        for (const resolvedId of [RESOLVED_CONFIG, RESOLVED_MDX]) {
          const mod = this.environment.moduleGraph.getModuleById(resolvedId)
          if (mod && !ctx.modules.includes(mod)) {
            ctx.modules = [...ctx.modules, mod]
          }
        }
      }

      // Re-read config + re-sync once per file-change event. We gate on
      // 'client' because Vite's handleHMRUpdate processes the client env
      // loop first (line 26572 in vite/dist/node/chunks/node.js), then
      // non-client envs (line 26595). By the time RSC/SSR hooks fire,
      // the shared config/syncResult is already fresh.
      if (this.environment.name === 'client') {
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

        ctx.server.environments.client?.hot.send({
          type: 'custom',
          event: 'rsc:update',
          data: { file: ctx.file },
        })
      }

      for (const resolvedId of [RESOLVED_CONFIG, RESOLVED_MDX]) {
        const mod = this.environment.moduleGraph.getModuleById(resolvedId)
        if (mod) {
          this.environment.moduleGraph.invalidateModule(mod)
        }
      }

      return []
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

  // Spiceflow adds `optimizeDeps.include` entries in the form
  // `'spiceflow > dep'`. Vite's nestedResolveBasedir looks up the left side
  // (`spiceflow`) starting from the consumer's project root — but when
  // @holocron.so/vite wraps spiceflow, the consumer only installs
  // @holocron.so/vite, so `spiceflow` is not directly resolvable from root
  // and the lookup fails. Rewrite every `'spiceflow > ...'` entry to
  // `'@holocron.so/vite > spiceflow > ...'` so Vite starts the lookup from
  // our own package (which IS in the consumer's node_modules). This plugin
  // must run AFTER spiceflowPlugin so the strings it rewrites are already
  // in the include array.
  const rewriteSpiceflowNestedIds: Plugin = {
    name: 'holocron:rewrite-spiceflow-nested-ids',
    configEnvironment(_name, config) {
      if (!config.optimizeDeps?.include) return
      config.optimizeDeps.include = (
        config.optimizeDeps.include as string[]
      ).map((entry) =>
        typeof entry === 'string' && entry.startsWith('spiceflow >')
          ? `@holocron.so/vite > ${entry}`
          : entry,
      )
    },
  }

  return [
    rawImportPlugin(),
    holocronPlugin,
    holocronRscPackagePlugin,
    spiceflowPlugin({ entry: VIRTUAL_APP }),
    rewriteSpiceflowNestedIds,
    tsconfigPaths(),
    tailwindcss(),
    // Include @vitejs/plugin-react by default unless the user already
    // added their own (detected by plugin name starting with "vite:react").
    ...(hasUserReactPlugin ? [] : [react()]),
  ]
}
