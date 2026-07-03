/**
 * Holocron Vite plugin. Reads docs.json/docs.jsonc/holocron.jsonc, syncs MDX, exposes
 * virtual modules for config/navigation/MDX, and auto-adds spiceflow +
 * tailwind + react plugins unless the user already installed them.
 *
 *   import { holocron } from '@holocron.so/vite/vite'
 *   export default defineConfig({ plugins: [holocron()] })
 */

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Plugin, PluginOption, ResolvedConfig, UserConfig } from 'vite'
import { spiceflowPlugin } from 'spiceflow/vite'
import tailwindcss from '@tailwindcss/vite'
import { readConfig, resolveConfigPath, type HolocronConfig } from './config.ts'
import { syncNavigation, processDeferredProviders, type SyncResult } from './lib/sync.ts'
import { colors, formatHolocronStep, formatHolocronSuccess, formatHolocronWarning, logger } from './lib/logger.ts'
import { hasHolocronApiKey, HOLOCRON_API_KEY_ENV_NAMES } from './lib/holocron-url.ts'

import react from '@vitejs/plugin-react'
import { cloudflare as cloudflarePlugin } from '@cloudflare/vite-plugin'

// `vite-plugin.ts` lives in `src/`, both in source and emitted `dist/`, so one
// `..` always gets back to the package root and `src/` from there is stable.
const __holocronSrcDir = fileURLToPath(new URL('../src', import.meta.url))
const HOLOCRON_APP_SRC_PATH = path.join(__holocronSrcDir, 'app.tsx')
const HOLOCRON_GLOBALS_CSS_PATH = path.join(__holocronSrcDir, 'styles/globals.css')
const nodeRequire = createRequire(import.meta.url)
const yamlBrowserEntry = path.join(path.dirname(nodeRequire.resolve('yaml/package.json')), 'browser/index.js')

export type HolocronVirtualModules = {
  /** Custom source for `virtual:holocron-config` */
  config?: string
  /** Custom source for `virtual:holocron-navigation` */
  navigation?: string
  /** Custom source for `virtual:holocron-mdx` */
  mdx?: string
}

export type HolocronPluginOptions = {
  /** Path to config file. Defaults to auto-discovery (docs.json, docs.jsonc, holocron.jsonc) */
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
  /**
   * Enable stable code-splitting groups for deploy deduplication.
   * When true (default), framework and vendor code is grouped into a
   * `holocron-stable` chunk and virtual module data into `holocron-data`,
   * maximizing content-addressable KV dedup across deploys.
   * Set to false to let Rolldown use its default splitting strategy.
   */
  codeSplitting?: boolean
}

const VIRTUAL_CONFIG = 'virtual:holocron-config'
const RESOLVED_CONFIG = '\0' + VIRTUAL_CONFIG

const VIRTUAL_NAVIGATION = 'virtual:holocron-navigation'
const RESOLVED_NAVIGATION = '\0' + VIRTUAL_NAVIGATION

const VIRTUAL_MDX = 'virtual:holocron-mdx'
const RESOLVED_MDX = '\0' + VIRTUAL_MDX

const VIRTUAL_MDX_PAGE_PREFIX = 'virtual:holocron-mdx-page/'
const RESOLVED_MDX_PAGE_PREFIX = '\0' + VIRTUAL_MDX_PAGE_PREFIX

const VIRTUAL_MODULES = 'virtual:holocron-modules'
const RESOLVED_MODULES = '\0' + VIRTUAL_MODULES

const VIRTUAL_PROVIDER_PREFIX = 'virtual:holocron-provider/'
const RESOLVED_PROVIDER_PREFIX = '\0' + VIRTUAL_PROVIDER_PREFIX

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

function addNoExternal(
  config: { resolve?: { noExternal?: string | RegExp | true | (string | RegExp)[] | undefined } },
  pkg: string | RegExp,
) {
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

/** Check if `child` is inside `parent` directory (proper path containment). */
function isInsideDir(parent: string, child: string): boolean {
  const rel = path.relative(parent, child)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

function toCssSourcePath(fromDir: string, toDir: string): string {
  const relativePath = path.relative(fromDir, toDir).replace(/\\/g, '/')
  if (relativePath === '') return '.'
  if (relativePath.startsWith('.')) return relativePath
  return './' + relativePath
}

// ── Code-splitting group definitions ────────────────────────────────
//
// Groups control how Rolldown splits shared modules into chunks.
// Higher priority wins when a module matches multiple groups.
//
// For deploy deduplication: stable dependency chunks keep the same
// content hash across deploys, so content-addressable KV storage can
// skip re-uploading them. The RSC entry (index.js) shrinks to just
// virtual modules and bootstrap code (~20KB), while all framework +
// vendor code goes into a stable chunk that's uploaded once.

// All stable code: node_modules + holocron framework + spiceflow runtime.
// Changes only when holocron/spiceflow version or user's deps change.
// The entry chunk is left with just virtual modules (~20KB) which change
// every deploy, maximizing content-addressable deduplication.
//
// Excludes .react-server. paths: these are RSC guard stubs with top-level
// `throw` statements (e.g. react-dom/server.react-server.js). Rolldown
// normally isolates them in tiny never-imported chunks. Merging them into
// the stable chunk crashes module initialization.
const STABLE_GROUP = {
  name: 'holocron-stable',
  test: /(?:node_modules|@holocron\.so[\/]vite[\/]|holocron[\/]vite[\/]src[\/]|spiceflow[\/])(?!.*\.react-server\.)/,
  priority: 20,
}

// Virtual module data: separate chunk with stable name for multi-tenant swapping.
// Excludes virtual:holocron-mdx-page/* (per-page chunks stay individual).
const HOLOCRON_DATA_GROUP = {
  name: 'holocron-data',
  test: /\0virtual:holocron-(?:config|navigation|mdx(?!-page)|modules)/,
  priority: 30,
}

function addCodeSplittingGroups(config: UserConfig, groups: Array<{ name: string; test: RegExp; priority: number }>) {
  config.build ??= {}
  config.build.rolldownOptions ??= {}
  const output = config.build.rolldownOptions.output ??= {}
  if (Array.isArray(output)) return
  const existing = Reflect.get(output, 'codeSplitting')

  if (existing === false) return

  if (existing && typeof existing === 'object') {
    const existingGroups = Reflect.get(existing, 'groups')
    Reflect.set(output, 'codeSplitting', {
      ...existing,
      groups: [...groups, ...(Array.isArray(existingGroups) ? existingGroups : [])],
    })
    return
  }

  Reflect.set(output, 'codeSplitting', { groups })
}

function getPluginName(plugin: PluginOption): string | undefined {
  if (!plugin || typeof plugin !== 'object' || Array.isArray(plugin) || plugin instanceof Promise) {
    return undefined
  }
  const maybeName = Reflect.get(plugin, 'name')
  return typeof maybeName === 'string' ? maybeName : undefined
}

import type { CustomTabProvider } from './lib/runtime-provider.ts'
import type { ConfigNavTab } from './config.ts'

/**
 * Load static custom provider files (static: true in tab config).
 *
 * Only static providers are imported at sync time so their generate() can
 * run during the build. Runtime providers (static: false, the default) are
 * loaded via Vite virtual modules at request time and don't need import()
 * here.
 */
async function loadStaticCustomProviders(
  config: HolocronConfig,
  projectRoot: string,
): Promise<Array<{ tab: ConfigNavTab; provider: CustomTabProvider }>> {
  const results: Array<{ tab: ConfigNavTab; provider: CustomTabProvider }> = []

  for (const tab of config.navigation.tabs) {
    if (!tab.provider || tab.static !== true) continue

    const absPath = path.isAbsolute(tab.provider)
      ? tab.provider
      : path.resolve(projectRoot, tab.provider)

    if (!fs.existsSync(absPath)) {
      logger.warn(
        formatHolocronWarning(
          `Provider file "${tab.provider}" not found for tab "${tab.tab}". ` +
          `Resolved to "${absPath}".`,
        ),
      )
      continue
    }

    try {
      const mod = await import(pathToFileURL(absPath).href)
      const provider = (mod.default ?? mod) as CustomTabProvider

      if (!provider.name || typeof provider.generate !== 'function') {
        logger.warn(
          formatHolocronWarning(
            `Provider file "${tab.provider}" must default-export an object with ` +
            `{ name: string, generate: Function }. Skipping tab "${tab.tab}".`,
          ),
        )
        continue
      }

      results.push({ tab, provider: { ...provider, static: true } })
    } catch (err) {
      logger.warn(
        formatHolocronWarning(
          `Failed to import provider "${tab.provider}" for tab "${tab.tab}": ` +
          `${err instanceof Error ? err.message : String(err)}`,
        ),
      )
    }
  }

  return results
}

export function holocron(options: HolocronPluginOptions = {}): PluginOption {
  let root: string
  let config: HolocronConfig
  let syncResult: SyncResult
  let pagesDir: string
  let publicDirPath: string
  let distDirPath: string
  let viteBase = '/'
  let hasUserReactPlugin = false
  let hasUserSpiceflowPlugin = false
  let hasUserTailwindPlugin = false
  let hasUserCloudflarePlugin = false
  const holocronPackagePattern = /^@holocron\.so\/vite(?:\/.*)?$/

  /** Resolved absolute path to the config file (docs.json, docs.jsonc, or holocron.jsonc) */
  let configFilePath: string | undefined

  /** Resolved absolute path to a user CSS file (global.css or style.css at root).
   *  Injected as an import in the app entry so user styles override holocron defaults. */
  let userCssPath: string | undefined
  let isBuild = false
  // Serialize HMR syncs so two rapid file changes don't run concurrent
  // syncNavigation calls. Vite's watcher fires onFileChange with .catch()
  // (fire-and-forget), so overlapping hotUpdate calls can race on the
  // shared config object and produce "MDX file not found" errors.
  let pendingSync: Promise<void> = Promise.resolve()
  /** Reference to the Vite dev server, stored in configureServer for
   *  background provider processing to invalidate modules + trigger HMR. */
  let viteServer: import('vite').ViteDevServer | undefined
  /** Abort controller for the current background provider processing run.
   *  Aborted on re-sync so stale provider results don't overwrite fresh nav. */
  let backgroundProviderAbort: AbortController | null = null


  /** Start background virtual tab provider processing (OpenAPI, changelog, MCP).
   *  Cancels any previous run. When done, patches syncResult with the new
   *  navigation tree and MDX content, invalidates virtual modules, and
   *  sends rsc:update so provider pages appear in the browser. */
  function startBackgroundProviderProcessing() {
    if (!viteServer) return

    backgroundProviderAbort?.abort()
    const abort = new AbortController()
    backgroundProviderAbort = abort
    const server = viteServer

    processDeferredProviders({
      config,
      projectRoot: root,
      pagesDir,
      publicDir: publicDirPath,
      distDir: distDirPath,
      syncResult,
      signal: abort.signal,
    }).then(({ watchPaths }) => {
      if (abort.signal.aborted) return

      // Watch newly-discovered provider paths (e.g. OpenAPI spec files)
      for (const watchPath of watchPaths) {
        server.watcher.add(watchPath)
      }

      // Invalidate all virtual modules so the next request picks up
      // the new navigation tree, MDX content, and import map.
      for (const resolvedId of [RESOLVED_CONFIG, RESOLVED_NAVIGATION, RESOLVED_MDX, RESOLVED_APP, RESOLVED_MODULES]) {
        for (const envName of ['rsc', 'ssr', 'client'] as const) {
          const env = server.environments[envName]
          if (!env) continue
          const mod = env.moduleGraph.getModuleById(resolvedId)
          if (mod) env.moduleGraph.invalidateModule(mod)
        }
      }

      // Invalidate per-page MDX modules for newly generated virtual pages
      for (const slug of Object.keys(syncResult.mdxContent)) {
        const resolvedId = RESOLVED_MDX_PAGE_PREFIX + encodeURIComponent(slug)
        for (const envName of ['rsc', 'ssr', 'client'] as const) {
          const env = server.environments[envName]
          if (!env) continue
          const mod = env.moduleGraph.getModuleById(resolvedId)
          if (mod) env.moduleGraph.invalidateModule(mod)
        }
      }

      server.environments.client?.hot.send({
        type: 'custom',
        event: 'rsc:update',
        data: { file: 'deferred-providers' },
      })

      logger.info(formatHolocronSuccess('background provider processing complete'))
    }).catch((err) => {
      if (!abort.signal.aborted) {
        logger.warn(formatHolocronWarning(
          `background provider processing failed: ${err instanceof Error ? err.message : String(err)}`,
        ))
      }
    })
  }

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
        const pluginName = getPluginName(plugin)
        if (typeof pluginName !== 'string') {
          continue
        }
        if (pluginName.startsWith('vite:react')) hasUserReactPlugin = true
        if (pluginName.startsWith('spiceflow:')) hasUserSpiceflowPlugin = true
        if (pluginName.startsWith('@tailwindcss/vite:')) hasUserTailwindPlugin = true
        if (pluginName === 'vite-plugin-cloudflare' || pluginName.startsWith('cloudflare')) hasUserCloudflarePlugin = true
      }

      // Alias `@holocron.so/vite/app` → source file. Must be done via
      // `resolve.alias`, not `resolveId`: Vite's built-in package resolver
      // runs before normal-phase plugin hooks for bare package ids and
      // would otherwise consume the `./app` export and return `dist/app.js`
      // (which is missing the CSS imports that only exist in src).
      // Also alias transitive runtime deps that Holocron source imports
      // directly. The consumer only installs `@holocron.so/vite`, so bare
      // imports like `safe-mdx/client` must resolve through our package too.
      const zoomEntry = nodeRequire.resolve('react-medium-image-zoom')
      const zoomDir = path.dirname(zoomEntry)
      // acorn ships both CJS (dist/acorn.js) and ESM (dist/acorn.mjs). Some
      // transitive deps use require("acorn") (e.g. acorn-jsx) while others use
      // ESM imports (e.g. micromark-extension-mdxjs). Without an alias, both
      // copies end up in the RSC bundle (~230KB each). Force the ESM entry.
      // Gracefully skip if the .mjs file doesn't exist (future acorn versions
      // may restructure their dist layout).
      const acornMjs = (() => {
        try {
          const mjs = path.join(path.dirname(nodeRequire.resolve('acorn')), 'acorn.mjs')
          if (fs.existsSync(mjs)) return mjs
        } catch {}
        return null
      })()
      // When deploying with --base-path, inject the base path into Vite's config
      // so all routes and assets are prefixed. Only applied during deploy builds.
      const deployBasePath = process.env.HOLOCRON_DEPLOY === '1'
        ? process.env.HOLOCRON_BASE_PATH
        : undefined

      const next: Pick<UserConfig, 'resolve' | 'build' | 'define' | 'base'> = {
        // When deploying with --base-path, set Vite's base option so all
        // routes and asset URLs are prefixed (e.g. /docs/assets/style.css).
        ...(deployBasePath && { base: deployBasePath }),
        // When running under `holocron deploy` (HOLOCRON_DEPLOY=1), write
        // build output to dist/.holocron so deploy artifacts don't collide
        // with a normal `vite build` (which targets Cloudflare/Node differently).
        ...(process.env.HOLOCRON_DEPLOY === '1' && {
          build: { outDir: 'dist/.holocron' },
        }),
        resolve: {
          alias: [
            { find: /^@holocron\.so\/vite\/app$/, replacement: HOLOCRON_APP_SRC_PATH },
            { find: /^react-medium-image-zoom$/, replacement: zoomEntry },
            { find: /^react-medium-image-zoom\/dist\/styles\.css$/, replacement: path.join(zoomDir, 'styles.css') },
            { find: /^yaml$/, replacement: yamlBrowserEntry },
            ...(acornMjs ? [{ find: /^acorn$/, replacement: acornMjs }] : []),
          ],
          dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
          tsconfigPaths: true,
        },
        define: {
          'import.meta.env.HOLOCRON_URL': JSON.stringify(process.env.HOLOCRON_URL),
        },
      }
      return next
    },

    async configResolved(resolved: ResolvedConfig) {
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

      // Clean stale build env folders so old artifacts never leak into
      // a fresh build. Preserve holocron-*.json caches for incremental builds.
      isBuild = resolved.command === 'build'
      if (isBuild) {
        for (const sub of ['client', 'rsc', 'ssr', 'package.json']) {
          try {
            fs.rmSync(path.join(distDirPath, sub), { recursive: true, force: true })
          } catch {}
        }
      }

      publicDirPath = resolved.publicDir || path.resolve(root, 'public')
      viteBase = resolved.base || '/'

      config = readConfig({ root, configPath: options.configPath })
      configFilePath = resolveConfigPath({ root, configPath: options.configPath })

      // Detect user CSS file at the project root (Mintlify convention).
      // First found wins: global.css → style.css.
      for (const name of ['global.css', 'style.css']) {
        const candidate = path.resolve(root, name)
        if (fs.existsSync(candidate)) {
          userCssPath = candidate
          break
        }
      }

      // Load static custom provider files (static: true in tab config).
      // Runtime providers are loaded via virtual modules at request time.
      const customProviders = await loadStaticCustomProviders(config, root)

      // Sync MDX + process images. In dev mode, virtual tab providers
      // (OpenAPI, changelog, MCP) are deferred to a background task so the
      // dev server starts immediately. Provider pages appear once the
      // background task finishes and triggers HMR.
      syncResult = await syncNavigation({
        config,
        pagesDir,
        publicDir: publicDirPath,
        projectRoot: root,
        distDir: distDirPath,
        logParseErrors: true,
        deferProviders: false,
        customProviders,
      })

      // In production builds, fail after ALL errors have been logged so
      // the user sees every issue at once instead of fixing them one by one.
      // Set HOLOCRON_SKIP_BUILD_ERRORS=true to bypass and deploy anyway.
      const skipBuildErrors = process.env.HOLOCRON_SKIP_BUILD_ERRORS === 'true'
      if (isBuild && !skipBuildErrors) {
        const errors: string[] = []
        const parseErrorCount = Object.keys(syncResult.mdxParseErrors).length
        if (parseErrorCount > 0) {
          errors.push(`${parseErrorCount} page${parseErrorCount === 1 ? '' : 's'} with MDX parse errors`)
        }
        const renderErrorCount = syncResult.mdxContentErrorCount - parseErrorCount
        if (renderErrorCount > 0) {
          errors.push(`${renderErrorCount} page${renderErrorCount === 1 ? '' : 's'} with MDX component errors`)
        }
        if (syncResult.brokenLinkCount > 0) {
          errors.push(`${syncResult.brokenLinkCount} broken internal link${syncResult.brokenLinkCount === 1 ? '' : 's'}`)
        }
        if (syncResult.brokenRedirectCount > 0) {
          errors.push(`${syncResult.brokenRedirectCount} redirect${syncResult.brokenRedirectCount === 1 ? '' : 's'} with invalid destination${syncResult.brokenRedirectCount === 1 ? '' : 's'}`)
        }
        if (syncResult.brokenAssetCount > 0) {
          errors.push(`${syncResult.brokenAssetCount} broken asset reference${syncResult.brokenAssetCount === 1 ? '' : 's'}`)
        }
        if (syncResult.brokenIconCount > 0) {
          errors.push(`${syncResult.brokenIconCount} unresolved icon${syncResult.brokenIconCount === 1 ? '' : 's'}`)
        }
        if (errors.length > 0) {
          throw new Error(
            `Build failed due to content errors:\n` +
            errors.map((e) => `  - ${e}`).join('\n') + '\n\n' +
            `All errors are listed above. Fix them or set HOLOCRON_SKIP_BUILD_ERRORS=true to bypass.`,
          )
        }
      }

      logger.info(
        formatHolocronSuccess(
          `synced ${syncResult.parsedCount} pages (${syncResult.cachedCount} cached)`,
        ),
      )
      if (userCssPath) {
        logger.info(
          formatHolocronStep({
            message: `using custom CSS: ${path.relative(root, userCssPath)}`,
          }),
        )
      }

      if (config.assistant?.enabled !== false && !hasHolocronApiKey()) {
        const envNames = HOLOCRON_API_KEY_ENV_NAMES.join(' or ')
        logger.warn('')
        logger.warn(
          formatHolocronWarning(
            `no ${envNames} found — AI chat will use a temporary model with lower limits.`,
          ),
        )
        logger.warn(
          `  Create a key: ${colors.cyan('npx -y @holocron.so/cli keys create --name production --project <projectId>')}`,
        )
        logger.warn(
          `  Then add ${colors.cyan('HOLOCRON_KEY=holo_xxx')} to your environment.`,
        )
        logger.warn('')
      }

    },

    async resolveId(id, importer) {
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
      if (id.startsWith(VIRTUAL_PROVIDER_PREFIX)) {
        return RESOLVED_PROVIDER_PREFIX + id.slice(VIRTUAL_PROVIDER_PREFIX.length)
      }
      if (id === VIRTUAL_MODULES) {
        return RESOLVED_MODULES
      }
      if (id === VIRTUAL_APP || id.endsWith('/' + VIRTUAL_APP)) {
        return RESOLVED_APP
      }
    },

    load(id) {
      if (id.replace(/[?#].*$/, '') === HOLOCRON_GLOBALS_CSS_PATH) {
        const pagesSourcePath = toCssSourcePath(path.dirname(HOLOCRON_GLOBALS_CSS_PATH), pagesDir)
        const configSourcePath = configFilePath
          ? toCssSourcePath(path.dirname(HOLOCRON_GLOBALS_CSS_PATH), configFilePath)
          : undefined
        return [
          fs.readFileSync(HOLOCRON_GLOBALS_CSS_PATH, 'utf-8'),
          '',
          '/* Scan the user docs tree too, including custom `pagesDir` locations. */',
          `@source ${JSON.stringify(pagesSourcePath)};`,
          configSourcePath && `@source not ${JSON.stringify(configSourcePath)};`,
        ].join('\n')
      }

      if (id === RESOLVED_CONFIG) {
        if (options.virtualModules?.config) {
          return options.virtualModules.config
        }
        // In build mode, serialize the already-parsed config as JSON so the
        // virtual module has zero runtime imports (no normalizer/logger/icons).
        // In dev mode, import raw config + parse at runtime for HMR.
        if (!configFilePath || isBuild) {
          return [
            `export const base = ${JSON.stringify(viteBase)}`,
            `const config = ${JSON.stringify(config)}`,
            `export async function getConfig() { return config }`,
          ].join('\n')
        }
        return [
          `import rawConfig from ${JSON.stringify(configFilePath + '?raw')}`,
          `import { parseConfigSource } from '@holocron.so/vite/src/config'`,
          `export const base = ${JSON.stringify(viteBase)}`,
          `export async function getConfig() { return parseConfigSource(rawConfig) }`,
          `if (import.meta.hot) import.meta.hot.accept()`,
        ].join('\n')
      }
      if (id === RESOLVED_NAVIGATION) {
        if (options.virtualModules?.navigation) {
          return options.virtualModules.navigation
        }
        // Generate runtime tab entries. Each provider is imported via virtual
        // module so Vite bundles the user's provider file into the server output.
        const lines: string[] = []
        const entryParts: string[] = []
        let providerIdx = 0

        for (const tabName of syncResult.runtimeTabNames) {
          const configTab = config.navigation.tabs.find((t) => t.tab === tabName)
          if (!configTab?.provider) continue

          const absPath = path.isAbsolute(configTab.provider)
            ? configTab.provider
            : path.resolve(root, configTab.provider)
          const importPath = VIRTUAL_PROVIDER_PREFIX + encodeURIComponent(absPath)

          const varName = `__runtimeProvider_${providerIdx++}`
          lines.push(`import { default as ${varName} } from ${JSON.stringify(importPath)}`)
          entryParts.push(`{ tabName: ${JSON.stringify(tabName)}, provider: ${varName} }`)
        }

        lines.push(
          `const navigation = ${JSON.stringify(syncResult.navigation)}`,
          `const switchers = ${JSON.stringify(syncResult.switchers)}`,
          `const mdxParseErrors = ${JSON.stringify(syncResult.mdxParseErrors)}`,
          `export const runtimeTabEntries = [${entryParts.join(', ')}]`,
          `export function getNavigationData() { return { navigation, switchers, mdxParseErrors } }`,
        )
        return lines.join('\n')
      }
      if (id === RESOLVED_MDX) {
        if (options.virtualModules?.mdx) {
          return options.virtualModules.mdx
        }
        // Register every known MDX file as a dependency so edits to existing
        // pages flow through the module graph (same mechanism as config above).
        // New MDX files that don't exist yet are handled separately in hotUpdate.
        // Include errored page slugs so their routes still get registered
        // (they render the error overlay instead of 404/redirect loops).
        const slugs = [...new Set([
          ...Object.keys(syncResult.mdxContent),
          ...Object.keys(syncResult.mdxParseErrors),
        ])].sort()
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
          // Page has a parse error or was filtered out — return undefined
          // so the render layer can show the error overlay instead of crashing.
          if (syncResult.mdxParseErrors[slug]) {
            return `export default undefined`
          }
          throw new Error(`[holocron] missing virtual MDX page for slug "${slug}"`)
        }
        return `export default ${JSON.stringify(markdown)}`
      }
      // virtual:holocron-provider/<encoded-path> → re-exports the user's file.
      // This indirection lets Vite bundle the provider into the server output.
      if (id.startsWith(RESOLVED_PROVIDER_PREFIX)) {
        const encodedPath = id.slice(RESOLVED_PROVIDER_PREFIX.length)
        const absPath = decodeURIComponent(encodedPath)
        this.addWatchFile(absPath)
        return `export { default } from ${JSON.stringify(pathToFileURL(absPath).href)}`
      }
      if (id === RESOLVED_MODULES) {
        // Build the lazy import map from import paths collected during MDX
        // sync. Only files actually imported by MDX pages are included,
        // rather than globbing entire convention folders like snippets/ or
        // components/. This is more precise and faster.
        const pagesDirRelative = path.relative(root, pagesDir)
        const pagesDirPrefix = pagesDirRelative === '' ? './' : `./${pagesDirRelative}/`

        // Flatten all per-page resolved imports into a unique map keyed by moduleKey.
        // moduleKey is what safe-mdx's resolveModulePath() will look up;
        // absPath is the real filesystem path for the import() call.
        const allImports = new Map<string, string>()
        for (const imports of Object.values(syncResult.pageImports)) {
          for (const { moduleKey, absPath } of imports) {
            if (!allImports.has(moduleKey)) {
              allImports.set(moduleKey, absPath)
            }
          }
        }

        const sortedImports = [...allImports.entries()]
          .sort(([a], [b]) => a.localeCompare(b))

        // Register imported .md/.mdx files as watch dependencies so edits
        // (including files added after initial startup) trigger HMR.
        for (const [moduleKey, absPath] of sortedImports) {
          if (!moduleKey.includes('?') && /\.mdx?$/.test(absPath)) {
            this.addWatchFile(absPath)
          }
        }
        // Watch image files referenced by imported .md/.mdx so dimension
        // or placeholder changes trigger re-sync.
        for (const imgPath of syncResult.importedImageDepPaths) {
          this.addWatchFile(imgPath)
        }

        // .md/.mdx imports are inlined at build time by remarkInlineImports,
        // so the import declaration in MDX is dead code. The virtual module
        // still needs to export something valid (safe-mdx resolves it), but
        // the component is never rendered since <Guide /> usages have been
        // replaced with the inlined content. We use a ?raw import wrapped
        // in a dummy component so the module graph tracks the file for HMR.
        const hasMdxImports = sortedImports.some(([moduleKey]) =>
          !moduleKey.includes('?') && /\.mdx?$/.test(moduleKey))
        const entries = sortedImports.map(([moduleKey, absPath]) => {
          const qIdx = moduleKey.indexOf('?')
          if (qIdx >= 0) {
            const querySuffix = moduleKey.slice(qIdx)
            return `  ${JSON.stringify(moduleKey)}: () => import(${JSON.stringify(absPath + querySuffix)})`
          }
          if (/\.mdx?$/.test(absPath)) {
            // Dead import: remarkInlineImports already spliced the content
            // inline. This wrapper exists only so the import resolves and
            // Vite tracks the file in the module graph for HMR.
            return `  ${JSON.stringify(moduleKey)}: async () => ({ default: function _InlinedMdx() { return null } })`
          }
          return `  ${JSON.stringify(moduleKey)}: () => import(${JSON.stringify(absPath)})`
        })

        return [
          `const modules = {`,
          entries.join(',\n'),
          `}`,
          `export function getModules() { return modules }`,
          `export const pagesDirPrefix = ${JSON.stringify(pagesDirPrefix)}`,
        ].join('\n')
      }
      if (id === RESOLVED_APP) {
        // When `options.entry` is set, re-export the user's file (they own
        // `.listen()`). Otherwise import the default holocron app and start
        // it ourselves. We use `./src/app` not `./app` so the id passes
        // through our resolveId hook for stable RSC package-source paths.

        // User CSS import (global.css or style.css at project root).
        // Uses file:// URL so Windows paths with backslashes work as
        // ES import specifiers. Imported after holocron's globals.css
        // (which lives inside app-factory.tsx) so user overrides win.
        const cssImportLine = userCssPath
          ? `import ${JSON.stringify(pathToFileURL(userCssPath).href)}`
          : undefined
        if (userCssPath) {
          this.addWatchFile(userCssPath)
        }

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
            `export * from ${JSON.stringify(userEntryPath)}`,
            `import * as __userEntry from ${JSON.stringify(userEntryPath)}`,
            cssImportLine,
            `export const app = __userEntry.app`,
            `export default __userEntry.default`,
          ].filter(Boolean).join('\n')
        }
        // listen() is NOT injected here — it's appended to the final RSC
        // entry chunk in renderChunk(). If we put it here, the bundler's
        // code-splitting moves it into a dependency chunk where
        // import.meta.url no longer points at the entry file and the
        // "is this the main module?" guard always fails.
        return [
          `import { app } from '@holocron.so/vite/src/app'`,
          cssImportLine,
          `export { app }`,
        ].filter(Boolean).join('\n')
      }
    },

    configureServer(server) {
      viteServer = server
      // Holocron's globals.css is injected from the package's own `src/` (see
      // HOLOCRON_GLOBALS_CSS_PATH). When the package is consumed normally it
      // lives under node_modules, which chokidar ignores by default, so edits
      // never reach the hotUpdate hook. Add it explicitly so styling changes
      // hot-reload during local development of holocron itself.
      server.watcher.add(HOLOCRON_GLOBALS_CSS_PATH)
      // User CSS is imported via the virtual app module, but the raw file
      // also needs to be watched by chokidar so edits trigger HMR.
      if (userCssPath) {
        server.watcher.add(userCssPath)
      }
      server.watcher.add(pagesDir)
      // Watch imported .md/.mdx files that live outside pagesDir so edits
      // trigger re-sync. Files inside pagesDir are already covered above.
      for (const imports of Object.values(syncResult.pageImports)) {
        for (const { absPath } of imports) {
          if (/\.mdx?$/.test(absPath) && !isInsideDir(pagesDir, absPath)) {
            server.watcher.add(absPath)
          }
        }
      }
      // Watch image files referenced by imported .md/.mdx so changing an
      // image (e.g. dimensions) triggers re-sync with updated metadata.
      for (const imgPath of syncResult.importedImageDepPaths) {
        server.watcher.add(imgPath)
      }
      // Watch files read by virtual tab providers (e.g. OpenAPI spec files)
      // so edits trigger re-sync + HMR.
      for (const watchPath of syncResult.providerWatchPaths) {
        server.watcher.add(watchPath)
      }
    },

    // hotUpdate — per-environment HMR hook.
    //
    // MDX files are scanned by Tailwind through @source, not imported as real
    // JS modules. If ctx.modules only contains the raw .mdx asset module,
    // @tailwindcss/vite treats the edit as an external template change and
    // sends a full reload. Inject the virtual modules that own MDX rendering
    // (same pattern as vite:import-glob) so Tailwind lets Holocron handle HMR.
    // Relevant upstream context:
    // - https://github.com/tailwindlabs/tailwindcss/issues/16764
    // - https://github.com/tailwindlabs/tailwindcss/issues/19903
    // - https://github.com/tailwindlabs/tailwindcss/pull/19904
    //
    // We return [] in ALL environments because ctx.modules also contains
    // the raw .mdx/.jsonc file entries which the RSC plugin would try to
    // transformRequest as JS and fail. Instead we invalidate the virtual
    // modules ourselves and send rsc:update manually.
    async hotUpdate(ctx) {
      const isMdx = ctx.file.endsWith('.mdx') || ctx.file.endsWith('.md')
      const isConfig = configFilePath && ctx.file === configFilePath
      const isTrackedImageDep = syncResult.importedImageDepPaths.includes(ctx.file)
      // Provider watch paths can be files (OpenAPI specs) or directories
      // (imageboard folders) — directories match any file inside them so
      // adding/editing/removing media re-syncs the generated page.
      const isProviderWatchPath = syncResult.providerWatchPaths.some(
        (watchPath) => watchPath === ctx.file || isInsideDir(watchPath, ctx.file),
      )
      // Holocron injects `src/styles/globals.css` directly from source into the
      // dev module graph, so editing it must reach the CSS-update path below.
      // Without this flag the early-return guard drops the event and styles only
      // refresh as a side effect of an unrelated mdx/config change.
      const isGlobalsCss = ctx.file.replace(/[?#].*$/, '') === HOLOCRON_GLOBALS_CSS_PATH
      const isMdxInsidePagesDir = isMdx && isInsideDir(pagesDir, ctx.file)
      const changedSlug = isMdxInsidePagesDir
        ? path.relative(pagesDir, ctx.file).replace(/\.[^.]+$/, '').replace(/\\/g, '/')
        : undefined

      // When an importable file (.tsx/.jsx/.ts/.js) is added or removed
      // in the project, re-sync navigation so pageImportPaths are refreshed
      // (a previously-unresolvable import may now resolve), then invalidate
      // the modules virtual module so it picks up the new import map.
      const isImportable = /\.[jt]sx?$/.test(ctx.file)
        && !ctx.file.includes('node_modules')
        && !ctx.file.includes('/dist/')
        && !/\.(test|spec)\./.test(ctx.file)
      const isImportableAddOrRemove = isImportable && ctx.type !== 'update'
      if (isImportableAddOrRemove) {
        const mod = this.environment.moduleGraph.getModuleById(RESOLVED_MODULES)
        if (mod) {
          this.environment.moduleGraph.invalidateModule(mod)
        }
      }

      if (!isMdx && !isConfig && !isImportableAddOrRemove && !isTrackedImageDep && !isProviderWatchPath && !isGlobalsCss) {
        return
      }

      if (isMdxInsidePagesDir) {
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
        // Abort any in-flight background provider processing — a new sync
        // will produce fresh deferred tasks that supersede the old ones.
        backgroundProviderAbort?.abort()

        const doSync = async () => {
          if (isConfig) {
            config = readConfig({ root, configPath: options.configPath })
          }
          // Preserve provider watch paths across deferred re-syncs so the
          // hotUpdate hook still recognizes provider file edits (e.g. OpenAPI
          // spec) during the window before background providers finish.
          const prevProviderWatchPaths = syncResult.providerWatchPaths
          const freshCustomProviders = await loadStaticCustomProviders(config, root)
          syncResult = await syncNavigation({
            config,
            pagesDir,
            publicDir: publicDirPath,
            projectRoot: root,
            distDir: distDirPath,
            deferProviders: true,
            customProviders: freshCustomProviders,
          })
          if (syncResult.providerWatchPaths.length === 0) {
            syncResult.providerWatchPaths = prevProviderWatchPaths
          }
        }
        pendingSync = pendingSync.catch(() => {}).then(doSync)
        await pendingSync

        // Start background provider processing for newly deferred tasks.
        startBackgroundProviderProcessing()

        // After re-sync, watch any new provider paths (e.g. a newly-added
        // OpenAPI spec) so future edits also trigger HMR.
        for (const watchPath of syncResult.providerWatchPaths) {
          ctx.server.watcher.add(watchPath)
        }
        // `rsc:update` refreshes the server-rendered page tree, but the root
        // loader still derives its `site` payload from these async provider
        // modules. Return them from the client hook too so Vite refreshes the
        // client graph instead of leaving navigation/search/title state stale.
        for (const resolvedId of [RESOLVED_CONFIG, RESOLVED_NAVIGATION, RESOLVED_MDX, RESOLVED_APP, RESOLVED_MODULES]) {
          const mod = this.environment.moduleGraph.getModuleById(resolvedId)
          if (mod) {
            clientHotModules.push(mod)
          }
        }
      }

      // HMR: invalidate provider modules + the per-page MDX virtual module.
      // Also invalidate RESOLVED_MODULES because syncNavigation may have
      // updated pageImportPaths (new imports in edited MDX, or newly-
      // resolvable paths when importable files are added/removed).
      const resolvedIds = new Set<string>([
        RESOLVED_CONFIG,
        RESOLVED_NAVIGATION,
        RESOLVED_MDX,
        RESOLVED_APP,
        RESOLVED_MODULES,
      ])

      if (isMdx || isTrackedImageDep || isProviderWatchPath) {
        if (ctx.type !== 'update') {
          resolvedIds.add(RESOLVED_MDX)
        }
        if (changedSlug) {
          resolvedIds.add(RESOLVED_MDX_PAGE_PREFIX + encodeURIComponent(changedSlug))
        }
        // When an imported .md/.mdx file, image dependency, or provider source
        // file (e.g. OpenAPI spec) changes, invalidate ALL per-page MDX modules
        // because the changed content affects virtual pages generated from it.
        if (isTrackedImageDep || isProviderWatchPath || !changedSlug || !syncResult.mdxContent[changedSlug]) {
          for (const slug of Object.keys(syncResult.mdxContent)) {
            resolvedIds.add(RESOLVED_MDX_PAGE_PREFIX + encodeURIComponent(slug))
          }
        }
      }

      for (const resolvedId of resolvedIds) {
        const mod = this.environment.moduleGraph.getModuleById(resolvedId)
        if (mod) {
          this.environment.moduleGraph.invalidateModule(mod)
        }
      }
      const cssMods = this.environment.moduleGraph.getModulesByFile(HOLOCRON_GLOBALS_CSS_PATH)
      if (cssMods) {
        for (const mod of cssMods) {
          this.environment.moduleGraph.invalidateModule(mod)
        }
      }

      // A direct edit to holocron's globals.css is a plain CSS change: let Vite's
      // native CSS HMR hot-swap the stylesheet by returning the CSS module(s)
      // from this hook. The manual css-update + rsc:update path below targets
      // the `?direct` module URL, which does not match the loaded <link> href
      // and forces a full page reload instead of a seamless style swap.
      if (isGlobalsCss && this.environment.name === 'client') {
        return [...(cssMods ?? [])]
      }

      if (this.environment.name === 'client') {
        const cssUpdates = [
          ...(this.environment.moduleGraph.getModulesByFile(HOLOCRON_GLOBALS_CSS_PATH) ?? []),
        ]
          .filter((mod): mod is NonNullable<typeof mod> => Boolean(mod))
          .filter((mod) => mod.url)
          .map((mod) => ({
            type: 'css-update' as const,
            timestamp: Date.now(),
            path: mod.url!,
            acceptedPath: mod.url!,
          }))
        if (cssUpdates.length > 0) {
          ctx.server.environments.client?.hot.send({
            type: 'update',
            updates: cssUpdates,
          })
        }
        ctx.server.environments.client?.hot.send({
          type: 'custom',
          event: 'rsc:update',
          data: { file: ctx.file },
        })
      }

      return this.environment.name === 'client' ? clientHotModules : []
    },

    // OIDC keyless registration runs in configResolved (above) and sets
    // HOLOCRON_KEY + github metadata from verified JWT claims. No buildEnd
    // registration needed: the API key path only bumped updatedAt which is
    // not useful. Actual deployment happens via `holocron deploy` CLI.
  }

  // Keep `@holocron.so/vite/*` inside the RSC/SSR transform pipeline so
  // `@vitejs/plugin-rsc` emits stable `client-package-proxy/...` imports.
  // Prism grammars are pre-bundled into src/generated/prism-bundle.js so
  // they don't trigger per-grammar optimize-deps discovery.
  const holocronRscPackagePlugin: Plugin = {
    name: 'holocron:rsc-package-source',
    configEnvironment(name, config) {
      // Exclude all @holocron.so/vite subpaths (e.g. @holocron.so/vite/src/serve-static)
      // from bundling/optimization in every environment via regex.
      addNoExternal(config, holocronPackagePattern)

      if (name === 'client') {
        config.optimizeDeps ??= {}
        config.optimizeDeps.exclude = mergeUnique(
          config.optimizeDeps.exclude,
          ['@holocron.so/vite', 'dialkit'],
        )
        config.optimizeDeps.include = mergeUnique(
          config.optimizeDeps.include,
          [
            '@holocron.so/vite > @orama/orama',
            '@holocron.so/vite > spiceflow > @vitejs/plugin-rsc/vendor/react-server-dom/client.browser',
            '@holocron.so/vite > cookie',
            // prismjs is pre-bundled into src/generated/prism-bundle.js, no optimize entry needed
            '@holocron.so/vite > mermaid',
            '@holocron.so/vite > clsx',
            '@holocron.so/vite > react-medium-image-zoom',
            '@holocron.so/vite > zustand',
            '@holocron.so/vite > tailwind-merge',
          ],
        )
      }

      // NOTE: MERMAID_GROUP was removed from client/ssr. Forcing mermaid + d3 +
      // lodash-es + katex into one chunk backfires: if ANY of those packages
      // share modules with non-mermaid code, the bundler creates a static
      // import edge from the editorial-page chunk to the mermaid chunk. This
      // makes the RSC plugin add <link rel="modulepreload"> for the 3.3MB
      // mermaid chunk on every page, even pages without mermaid diagrams.
      // The dynamic `import('#mermaid')` in mermaid.tsx already creates a
      // natural code-splitting boundary; the bundler handles this correctly
      // without forced grouping.

      // Split stable deps (framework + node_modules) into their own chunk
      // so the RSC entry only contains virtual modules (~20KB). Maximizes
      // content-addressable dedup for holocron deploy.
      // RSC-only — SSR is self-contained and not dynamically imported.
      // Only enabled during holocron deploy (HOLOCRON_DEPLOY=1) by default;
      // the stable chunk is only useful for content-addressable KV dedup.
      // Users can force it on/off with the codeSplitting option.
      const enableCodeSplitting = options.codeSplitting ?? (process.env.HOLOCRON_DEPLOY === '1')
      if (name === 'rsc' && enableCodeSplitting) {
        addCodeSplittingGroups(config, [HOLOCRON_DATA_GROUP, STABLE_GROUP])

        // Deterministic names: holocron-data.js + holocron-page-{slug}.js
        config.build ??= {}
        config.build.rolldownOptions ??= {}
        const output = config.build.rolldownOptions.output ??= {}
        if (!Array.isArray(output)) {
          // Keep original export names across chunk boundaries
          ;(output as any).minifyInternalExports = false
          const existingChunkFileNames = output.chunkFileNames
          output.chunkFileNames = (chunkInfo) => {
            if (chunkInfo.name === 'holocron-data') {
              return 'assets/holocron-data.js'
            }
            const mdxPageId = chunkInfo.moduleIds.find((id) => id.includes('\0virtual:holocron-mdx-page/'))
            if (mdxPageId) {
              const slug = decodeURIComponent(mdxPageId.split('\0virtual:holocron-mdx-page/')[1] ?? '')
              const readable = slug.replace(/\//g, '--')
              const hash = createHash('sha256').update(slug).digest('hex').slice(0, 8)
              return `assets/holocron-page-${readable}-${hash}.js`
            }
            if (typeof existingChunkFileNames === 'function') {
              return existingChunkFileNames(chunkInfo)
            }
            return existingChunkFileNames ?? 'assets/[name]-[hash].js'
          }
        }
      }

      if (name === 'rsc' || name === 'ssr') {
        // addNoExternal(config, 'fflate')
        config.optimizeDeps ??= {}
        config.optimizeDeps.include ??= []
        config.optimizeDeps.include.push('@holocron.so/vite > fflate')
        config.optimizeDeps.exclude = mergeUnique(
          config.optimizeDeps.exclude,
          ['spiceflow'],
        )
      }
    },
  }

  const dynamicWorkerModulePlugin: Plugin = {
    name: 'holocron:dynamic-worker-modules',
    renderChunk(code) {
      if (process.env.HOLOCRON_DEPLOY !== '1') return
      if (this.environment.name === 'client') return
      if (!code.includes('createRequire(import.meta.url)')) return

      // Dynamic Workers currently expose `import.meta.url` as undefined. Rolldown
      // may emit an unused CommonJS helper that eagerly calls createRequire with
      // import.meta.url, which crashes module evaluation before the real app runs.
      // Replacing only the helper factory keeps genuinely unsupported runtime
      // require() calls failing clearly while allowing unused helpers to exist.
      return code.replaceAll(
        'createRequire(import.meta.url)',
        '(() => { throw new Error("require is unavailable in Dynamic Workers") })',
      )
    },
  }

  const tailwindHmrOwnerPlugin: Plugin = {
    name: 'holocron:tailwind-hmr-owner',
    enforce: 'pre',
    hotUpdate(ctx) {
      const isMdx = (ctx.file.endsWith('.mdx') || ctx.file.endsWith('.md'))
        && isInsideDir(pagesDir, ctx.file)
      const isConfig = Boolean(configFilePath && ctx.file === configFilePath)
      if (!isMdx && !isConfig) return

      // @tailwindcss/vite also runs in `enforce: pre`. It full-reloads when
      // every module for a scanned file is an asset/no-id module. MDX pages are
      // scanned by @source but rendered through these virtual modules, so mark
      // the update as framework-owned before Tailwind's HMR hook runs.
      // This is the same class of workaround discussed in:
      // https://github.com/tailwindlabs/tailwindcss/issues/16764
      for (const resolvedId of [RESOLVED_CONFIG, RESOLVED_NAVIGATION, RESOLVED_MDX]) {
        const mod = this.environment.moduleGraph.getModuleById(resolvedId)
        if (mod && !ctx.modules.includes(mod)) {
          ctx.modules = [...ctx.modules, mod]
        }
      }
    },
  }

  // Append listen() to the RSC entry chunk AFTER bundling.
  //
  // The listen guard cannot live in virtual:holocron-app because the
  // STABLE_GROUP code-splitting config moves all framework code (anything
  // matching node_modules/, @holocron.so/vite/, spiceflow/) into a separate
  // chunk. Once there, import.meta.url resolves to the chunk's URL instead
  // of the entry's URL, so the "is this the main module?" check always
  // fails and the server never starts.
  //
  // By appending in renderChunk we guarantee the code is physically in
  // index.js where import.meta.url is correct.
  const listenGuardPlugin: Plugin = {
    name: 'holocron:listen-guard',
    renderChunk(code, chunk) {
      // Only inject into the RSC entry chunk, and skip when the user
      // provides their own entry (they own .listen() themselves).
      if (this.environment.name !== 'rsc') return
      if (!chunk.isEntry) return
      if (options.entry) return

      const guard = [
        '',
        '// Auto-injected listen guard (holocron:listen-guard plugin).',
        '// Appended to the entry chunk so import.meta.url correctly',
        '// resolves to this file for the "is main module?" check.',
        'import { fileURLToPath as __hcFileURLToPath } from "node:url";',
        'import { realpathSync as __hcRealpathSync } from "node:fs";',
        'const __hcIsMain = typeof import.meta.main === "boolean"',
        '  ? import.meta.main',
        '  : typeof process !== "undefined" && process.argv[1] && typeof import.meta.url === "string"',
        '    ? __hcFileURLToPath(import.meta.url) === __hcRealpathSync(process.argv[1])',
        '    : false;',
        'if (__hcIsMain) app.listen(Number(process.env.PORT || 3000));',
      ].join('\n')

      return code + guard
    },
  }

  const pluginsToReturn: PluginOption[] = [
    rawImportPlugin(),
    tailwindHmrOwnerPlugin,
    holocronPlugin,
    holocronRscPackagePlugin,
    dynamicWorkerModulePlugin,
    listenGuardPlugin,
  ]

  // Auto-inject the Cloudflare plugin for deploy builds. Added before
  // spiceflow so hasPluginNamed() sees it in config() and sets
  // noExternal=true for rsc/ssr.
  if (process.env.HOLOCRON_DEPLOY === '1' && !hasUserCloudflarePlugin) {
    pluginsToReturn.push(
      cloudflarePlugin({
        viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      }),
    )
  }

  // Auto-add spiceflow/tailwind/react unless the user already installed each.
  // Custom entries must stay as filesystem entries so vite-rsc can walk their
  // imports and collect Holocron's global CSS under Cloudflare dev.
  if (!hasUserSpiceflowPlugin) {
    pluginsToReturn.push(
      spiceflowPlugin({
        entry: options.entry ?? VIRTUAL_APP,
        serveStaticImport: '@holocron.so/vite/src/serve-static',
      }),
    )
  }
  if (!hasUserTailwindPlugin) {
    pluginsToReturn.push(tailwindcss())
  }
  if (!hasUserReactPlugin) {
    pluginsToReturn.push(react())
  }

  return pluginsToReturn
}
