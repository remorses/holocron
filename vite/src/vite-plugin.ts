/**
 * Holocron Vite plugin. Reads holocron.jsonc/docs.json, syncs MDX, exposes
 * virtual modules for config/navigation/MDX, and auto-adds spiceflow +
 * tailwind + react plugins unless the user already installed them.
 *
 *   import { holocron } from '@holocron.so/vite/vite'
 *   export default defineConfig({ plugins: [holocron()] })
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin, PluginOption, ResolvedConfig, UserConfig } from 'vite'
import { spiceflowPlugin } from 'spiceflow/vite'
import tailwindcss from '@tailwindcss/vite'
import { readConfig, resolveConfigPath, type HolocronConfig } from './config.ts'
import { syncNavigation, type SyncResult } from './lib/sync.ts'
import { prismLanguageIds } from './components/markdown/prism-languages.ts'
import react from '@vitejs/plugin-react'

// Absolute path to our own `src/app.tsx`, computed from this file's URL so
// it works regardless of package layout / hoisting / symlinks.
const __thisFilePath = fileURLToPath(import.meta.url)
const __holocronSrcDir = (() => {
  let dir = path.dirname(__thisFilePath)
  while (dir !== path.dirname(dir)) {
    if (path.basename(dir) === 'src' && fs.existsSync(path.join(dir, 'app.tsx'))) {
      return dir
    }
    dir = path.dirname(dir)
  }
  const fallback = path.resolve(path.dirname(__thisFilePath), '..', 'src')
  return fs.existsSync(fallback) ? fallback : path.dirname(__thisFilePath)
})()
const HOLOCRON_APP_SRC_PATH = path.join(__holocronSrcDir, 'app.tsx')

export type HolocronVirtualModules = {
  /** Custom source for `virtual:holocron-config` */
  config?: string
  /** Custom source for `virtual:holocron-navigation` */
  navigation?: string
  /** Custom source for `virtual:holocron-mdx` */
  mdx?: string
}

export type HolocronPluginOptions = {
  /** Path to config file. Defaults to auto-discovery (holocron.jsonc, docs.json) */
  configPath?: string
  /** Path to pages directory. Defaults to '.' (project root, matching Mintlify convention) */
  pagesDir?: string
  /**
   * Path to a user-written spiceflow entry file (relative to vite root).
   * The file must export a Spiceflow instance as `app` and call `.listen()`.
   * Use this to mount holocron as a child of your own Spiceflow tree.
   */
  entry?: string
  /** Override virtual module source code for runtime-backed experiments. */
  virtualModules?: HolocronVirtualModules
}

const VIRTUAL_CONFIG = 'virtual:holocron-config'
const RESOLVED_CONFIG = '\0' + VIRTUAL_CONFIG

const VIRTUAL_NAVIGATION = 'virtual:holocron-navigation'
const RESOLVED_NAVIGATION = '\0' + VIRTUAL_NAVIGATION

const VIRTUAL_MDX = 'virtual:holocron-mdx'
const RESOLVED_MDX = '\0' + VIRTUAL_MDX

const VIRTUAL_MDX_PAGE_PREFIX = 'virtual:holocron-mdx-page/'
const RESOLVED_MDX_PAGE_PREFIX = '\0' + VIRTUAL_MDX_PAGE_PREFIX

const VIRTUAL_APP = 'virtual:holocron-app'
const RESOLVED_APP = '\0' + VIRTUAL_APP

function getMdxPathForSlug(pagesDir: string, slug: string): string | undefined {
  for (const ext of ['.mdx', '.md']) {
    const mdxPath = path.join(pagesDir, slug + ext)
    if (fs.existsSync(mdxPath)) {
      return mdxPath
    }
  }
}

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
  let viteBase = '/'
  let resolveHolocronPackagePath:
    | ((id: string, importer?: string, ssr?: boolean) => Promise<string | undefined>)
    | undefined

  let hasUserReactPlugin = false
  let hasUserSpiceflowPlugin = false
  let hasUserTailwindPlugin = false
  const holocronPackagePattern = /^@holocron\.so\/vite(?:\/.*)?$/

  /** Resolved absolute path to the config file (holocron.jsonc or docs.json) */
  let configFilePath: string | undefined

  const holocronPlugin: Plugin = {
    name: 'holocron',

    config(viteConfig) {
      root = viteConfig.root || process.cwd()
      pagesDir = options.pagesDir
        ? path.resolve(root, options.pagesDir)
        : root

      // Flatten plugin tree and detect user-installed duplicates we should skip.
      const pendingPlugins = [...(viteConfig.plugins ?? [])]
      const allPlugins: PluginOption[] = []
      while (pendingPlugins.length > 0) {
        const plugin = pendingPlugins.shift()
        if (!plugin) continue
        if (Array.isArray(plugin)) {
          pendingPlugins.unshift(...plugin)
          continue
        }
        allPlugins.push(plugin)
      }
      for (const plugin of allPlugins) {
        if (!plugin || typeof plugin !== 'object' || !('name' in plugin) || typeof plugin.name !== 'string') {
          continue
        }
        if (plugin.name.startsWith('vite:react')) hasUserReactPlugin = true
        if (plugin.name.startsWith('spiceflow:')) hasUserSpiceflowPlugin = true
        if (plugin.name.startsWith('@tailwindcss/vite:')) hasUserTailwindPlugin = true
      }

      // Alias `@holocron.so/vite/app` → source file. Must be done via
      // `resolve.alias`, not `resolveId`: Vite's built-in package resolver
      // runs before normal-phase plugin hooks for bare package ids and
      // would otherwise consume the `./app` export and return `dist/app.js`
      // (which is missing the CSS imports that only exist in src).
      const next: Pick<UserConfig, 'resolve'> = {
        resolve: {
          alias: [
            { find: /^@holocron\.so\/vite\/app$/, replacement: HOLOCRON_APP_SRC_PATH },
          ],
          dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
          tsconfigPaths: true,
        },
      }
      return next
    },

    async configResolved(resolved: ResolvedConfig) {
      // Keep Holocron runtime subpaths looking like package imports in dev.
      // `@vitejs/plugin-rsc` only records package client sources when the
      // resolved id still includes `/node_modules/`. If Vite realpaths
      // symlinks, the path escapes node_modules and client boundaries break.
      const preserveSymlinkResolver = resolved.createResolver({ preserveSymlinks: true })
      resolveHolocronPackagePath = async (id, importer, ssr) => {
        return await preserveSymlinkResolver(id, importer, false, ssr)
      }

      // CRITICAL: overwrite `root` with the RESOLVED absolute path. In the
      // `config()` hook above, `viteConfig.root` comes straight from the
      // user's config (or the CLI positional arg) and may still be a
      // RELATIVE path like "fixtures/basic". Feeding that to
      // `resolveConfigPath` produces a relative config path, which then
      // flows into `this.addWatchFile()` in load() — and Vite tries to
      // resolve that relative path as an import of the virtual module,
      // crashing with "Failed to resolve import fixtures/.../holocron.jsonc
      // from virtual:holocron-config".
      root = resolved.root
      pagesDir = options.pagesDir
        ? path.resolve(root, options.pagesDir)
        : root

      distDirPath = resolved.build?.outDir
        ? path.resolve(root, resolved.build.outDir)
        : path.resolve(root, 'dist')

      publicDirPath = resolved.publicDir || path.resolve(root, 'public')
      viteBase = resolved.base || '/'

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

      console.log(
        `[holocron] synced ${syncResult.parsedCount} pages (${syncResult.cachedCount} cached)`,
      )
    },

    async resolveId(id, importer) {
      // `@holocron.so/vite/app` is handled by resolve.alias in config().
      // The `./src/*` branch stays here for holocron's own internal imports.
      if (id.startsWith('@holocron.so/vite/src/')) {
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
      if (id === VIRTUAL_NAVIGATION) {
        return RESOLVED_NAVIGATION
      }
      if (id === VIRTUAL_MDX) {
        return RESOLVED_MDX
      }
      if (id.startsWith(VIRTUAL_MDX_PAGE_PREFIX)) {
        return RESOLVED_MDX_PAGE_PREFIX + id.slice(VIRTUAL_MDX_PAGE_PREFIX.length)
      }
      if (id === VIRTUAL_APP || id.endsWith('/' + VIRTUAL_APP)) {
        return RESOLVED_APP
      }
    },

    load(id) {
      if (id === RESOLVED_CONFIG) {
        if (options.virtualModules?.config) {
          return options.virtualModules.config
        }
        // Register the config file as a dependency so it enters the module
        // graph. When the file changes, Vite associates the change with this
        // virtual module — @tailwindcss/vite sees a JS module in ctx.modules
        // and skips its full-reload, and @vitejs/plugin-rsc handles the HMR
        // via rsc:update automatically.
        if (configFilePath) {
          this.addWatchFile(configFilePath)
        }
        return [
          `export const base = ${JSON.stringify(viteBase)}`,
          `const config = ${JSON.stringify(config)}`,
          `export function getConfig() { return config }`,
        ].join('\n')
      }
      if (id === RESOLVED_NAVIGATION) {
        if (options.virtualModules?.navigation) {
          return options.virtualModules.navigation
        }
        return [
          `const navigation = ${JSON.stringify(syncResult.navigation)}`,
          `const switchers = ${JSON.stringify(syncResult.switchers)}`,
          `export function getNavigationData() { return { navigation, switchers } }`,
        ].join('\n')
      }
      if (id === RESOLVED_MDX) {
        if (options.virtualModules?.mdx) {
          return options.virtualModules.mdx
        }
        // Register every known MDX file as a dependency so edits to existing
        // pages flow through the module graph (same mechanism as config above).
        // New MDX files that don't exist yet are handled separately in hotUpdate.
        const slugs = Object.keys(syncResult.mdxContent).sort()
        for (const slug of slugs) {
          const mdxPath = getMdxPathForSlug(pagesDir, slug)
          if (mdxPath) {
            this.addWatchFile(mdxPath)
          }
        }
        const loaderEntries = slugs.map((slug) => {
          return `${JSON.stringify(slug)}: () => import(${JSON.stringify(VIRTUAL_MDX_PAGE_PREFIX + encodeURIComponent(slug))}).then((m) => m.default)`
        })
        return [
          `const slugs = ${JSON.stringify(slugs)}`,
          `const pageIconRefs = ${JSON.stringify(syncResult.pageIconRefs)}`,
          `const loaders = { ${loaderEntries.join(', ')} }`,
          `export function getMdxSlugs() { return slugs }`,
          `export async function getMdxSource(slug) {`,
          `  const load = loaders[slug]`,
          `  return load ? await load() : undefined`,
          `}`,
          `export function getPageIconRefs(slug) { return pageIconRefs[slug] ?? [] }`,
        ].join('\n')
      }
      if (id.startsWith(RESOLVED_MDX_PAGE_PREFIX)) {
        const slug = decodeURIComponent(id.slice(RESOLVED_MDX_PAGE_PREFIX.length))
        const mdxPath = getMdxPathForSlug(pagesDir, slug)
        if (mdxPath) {
          this.addWatchFile(mdxPath)
        }
        const markdown = syncResult.mdxContent[slug]
        if (markdown === undefined) {
          throw new Error(`[holocron] missing virtual MDX page for slug "${slug}"`)
        }
        return `export default ${JSON.stringify(markdown)}`
      }
      if (id === RESOLVED_APP) {
        // When `options.entry` is set, re-export the user's file (they own
        // `.listen()`). Otherwise import the default holocron app and start
        // it ourselves. We use `./src/app` not `./app` so the id passes
        // through our resolveId hook for stable RSC package-source paths.
        if (options.entry) {
          const userEntryPath = path.isAbsolute(options.entry)
            ? options.entry
            : path.resolve(root, options.entry)
          if (!fs.existsSync(userEntryPath)) {
            throw new Error(
              `[holocron] entry file not found: ${userEntryPath}\n` +
              `Set \`holocron({ entry: './your-file.ts' })\` to a path relative to the vite root, or pass an absolute path.`,
            )
          }
          this.addWatchFile(userEntryPath)
          return [
            `import * as __userEntry from ${JSON.stringify(userEntryPath)}`,
            `export const app = __userEntry.app`,
            `export default __userEntry.default`,
          ].join('\n')
        }
        return [
          `import { app } from '@holocron.so/vite/src/app'`,
          `export { app }`,
          `app.listen(Number(process.env.PORT || 3000))`,
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
      const changedSlug = isMdx && ctx.file.startsWith(pagesDir)
        ? path.relative(pagesDir, ctx.file).replace(/\.[^.]+$/, '').replace(/\\/g, '/')
        : undefined

      if (!isMdx && !isConfig) {
        return
      }

      // For new/deleted MDX files (type !== "update"), the file isn't
      // registered via addWatchFile yet so our virtual modules won't be
      // in ctx.modules. Inject them — mirroring how vite:import-glob
      // adds glob-owning modules on create/delete. This makes downstream
      // plugins (Tailwind) see a JS module and skip their full-reload.
      if (ctx.type !== 'update' && isMdx && ctx.file.startsWith(pagesDir)) {
        for (const resolvedId of [RESOLVED_CONFIG, RESOLVED_NAVIGATION, RESOLVED_MDX]) {
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
      let clientHotModules: NonNullable<ReturnType<typeof this.environment.moduleGraph.getModuleById>>[] = []
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

        // `rsc:update` refreshes the server-rendered page tree, but the root
        // loader still derives its `site` payload from these async provider
        // modules. Return them from the client hook too so Vite refreshes the
        // client graph instead of leaving navigation/search/title state stale.
        for (const resolvedId of [RESOLVED_CONFIG, RESOLVED_NAVIGATION, RESOLVED_MDX, RESOLVED_APP]) {
          const mod = this.environment.moduleGraph.getModuleById(resolvedId)
          if (mod) {
            clientHotModules.push(mod)
          }
        }
      }

      // HMR: invalidate provider modules + the per-page MDX virtual module.
      const resolvedIds = new Set<string>([
        RESOLVED_CONFIG,
        RESOLVED_NAVIGATION,
        RESOLVED_MDX,
        RESOLVED_APP,
      ])

      if (isMdx) {
        if (ctx.type !== 'update') {
          resolvedIds.add(RESOLVED_MDX)
        }
        if (changedSlug) {
          resolvedIds.add(RESOLVED_MDX_PAGE_PREFIX + encodeURIComponent(changedSlug))
        }
      }

      for (const resolvedId of resolvedIds) {
        const mod = this.environment.moduleGraph.getModuleById(resolvedId)
        if (mod) {
          this.environment.moduleGraph.invalidateModule(mod)
        }
      }

      return this.environment.name === 'client' ? clientHotModules : []
    },
  }

  // Keep `@holocron.so/vite/*` inside the RSC/SSR transform pipeline so
  // `@vitejs/plugin-rsc` emits stable `client-package-proxy/...` imports.
  // Prism is pre-bundled via the `@holocron.so/vite > ...` nested id so the
  // resolver starts from our package (prism ships transitively with it).
  const holocronRscPackagePlugin: Plugin = {
    name: 'holocron:rsc-package-source',
    configEnvironment(name, config) {
      if (name === 'client') {
        config.optimizeDeps ??= {}
        config.optimizeDeps.exclude = mergeUnique(
          config.optimizeDeps.exclude,
          ['@holocron.so/vite'],
        )
        config.optimizeDeps.include = mergeUnique(
          config.optimizeDeps.include,
          ['@holocron.so/vite > prismjs', ...prismLanguageIds.map((id) => `@holocron.so/vite > prismjs/components/prism-${id}`)],
        )
      }

      if (name === 'rsc' || name === 'ssr') {
        addNoExternal(config, holocronPackagePattern)
      }
    },
  }

  const pluginsToReturn: PluginOption[] = [
    rawImportPlugin(),
    holocronPlugin,
    holocronRscPackagePlugin,
  ]

  // Auto-add spiceflow/tailwind/react unless the user already installed each.
  // The `virtual:holocron-app` entry either boots the default holocron app
  // or re-exports the user's custom entry (see RESOLVED_APP in load()).
  if (!hasUserSpiceflowPlugin) {
    pluginsToReturn.push(spiceflowPlugin({ entry: VIRTUAL_APP }))
  }
  if (!hasUserTailwindPlugin) {
    pluginsToReturn.push(tailwindcss())
  }
  if (!hasUserReactPlugin) {
    pluginsToReturn.push(react())
  }

  return pluginsToReturn
}
