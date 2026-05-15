/**
 * Holocron Vite plugin. Reads docs.json/docs.jsonc/holocron.jsonc, syncs MDX, exposes
 * virtual modules for config/navigation/MDX, and auto-adds spiceflow +
 * tailwind + react plugins unless the user already installed them.
 *
 *   import { holocron } from '@holocron.so/vite/vite'
 *   export default defineConfig({ plugins: [holocron()] })
 */

import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Plugin, PluginOption, ResolvedConfig, UserConfig } from 'vite'
import { spiceflowPlugin } from 'spiceflow/vite'
import tailwindcss from '@tailwindcss/vite'
import { readConfig, resolveConfigPath, type HolocronConfig } from './config.ts'
import { syncNavigation, type SyncResult } from './lib/sync.ts'
import { colors, formatHolocronStep, formatHolocronSuccess, formatHolocronWarning, logger } from './lib/logger.ts'

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

const MERMAID_GROUP = {
  name: 'holocron-mermaid',
  test: /node_modules[\/](?:\.pnpm[\/])?(?:mermaid|@mermaid-js|cytoscape|cytoscape-cose-bilkent|dagre|dagre-d3-es|graphlib|katex|khroma|roughjs|stylis|d3(?:-|[\/])|lodash-es)/,
  priority: 30,
}

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

export function holocron(options: HolocronPluginOptions = {}): PluginOption {
  let root: string
  let config: HolocronConfig
  let syncResult: SyncResult
  let pagesDir: string
  let publicDirPath: string
  let distDirPath: string
  let viteBase = '/'
  let resolveHolocronPackagePath:
    | ((args: { id: string; importer?: string; ssr?: boolean }) => Promise<string | undefined>)
    | undefined

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
      const safeMdxDir = path.dirname(nodeRequire.resolve('safe-mdx/package.json'))
      const zoomEntry = nodeRequire.resolve('react-medium-image-zoom')
      const zoomDir = path.dirname(zoomEntry)
      const next: Pick<UserConfig, 'resolve' | 'build'> = {
        // When running under `holocron deploy` (HOLOCRON_DEPLOY=1), write
        // build output to dist/.holocron so deploy artifacts don't collide
        // with a normal `vite build` (which targets Cloudflare/Node differently).
        ...(process.env.HOLOCRON_DEPLOY === '1' && {
          build: { outDir: 'dist/.holocron' },
        }),
        resolve: {
          alias: [
            { find: /^@holocron\.so\/vite\/app$/, replacement: HOLOCRON_APP_SRC_PATH },
            { find: /^safe-mdx$/, replacement: path.join(safeMdxDir, 'dist/safe-mdx.js') },
            { find: /^safe-mdx\/parse$/, replacement: path.join(safeMdxDir, 'dist/parse.js') },
            { find: /^safe-mdx\/client$/, replacement: path.join(safeMdxDir, 'dist/dynamic-esm-component.js') },
            { find: /^react-medium-image-zoom$/, replacement: zoomEntry },
            { find: /^react-medium-image-zoom\/dist\/styles\.css$/, replacement: path.join(zoomDir, 'styles.css') },
            { find: /^yaml$/, replacement: yamlBrowserEntry },
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
      resolveHolocronPackagePath = async ({ id, importer, ssr }) => {
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

      // Detect user CSS file at the project root (Mintlify convention).
      // First found wins: global.css → style.css.
      for (const name of ['global.css', 'style.css']) {
        const candidate = path.resolve(root, name)
        if (fs.existsSync(candidate)) {
          userCssPath = candidate
          break
        }
      }

      // Sync MDX + process images at build time. The returned navigation
      // tree contains pre-processed MDX (paths rewritten, dimensions injected).
      syncResult = await syncNavigation({
        config,
        pagesDir,
        publicDir: publicDirPath,
        projectRoot: root,
        distDir: distDirPath,
        logParseErrors: resolved.command !== 'build',
      })

      if (resolved.command === 'build') {
        const firstParseError = Object.values(syncResult.mdxParseErrors)[0]
        if (firstParseError) throw new Error(firstParseError.message)
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

      if (config.assistant?.enabled !== false && !process.env.HOLOCRON_KEY) {
        logger.warn('')
        logger.warn(
          formatHolocronWarning(
            `no HOLOCRON_KEY found — AI chat will use a temporary model with lower limits.`,
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
      // `@holocron.so/vite/app` is handled by resolve.alias in config().
      // The `./src/*` branch stays here for holocron's own internal imports.
      if (id.startsWith('@holocron.so/vite/src/')) {
        const resolved = await resolveHolocronPackagePath?.(
          { id, importer, ssr: this.environment.name === 'ssr' },
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
        return [
          fs.readFileSync(HOLOCRON_GLOBALS_CSS_PATH, 'utf-8'),
          '',
          '/* Scan the user docs tree too, including custom `pagesDir` locations. */',
          `@source ${JSON.stringify(pagesSourcePath)};`,
        ].join('\n')
      }

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
          `const mdxParseErrors = ${JSON.stringify(syncResult.mdxParseErrors)}`,
          `export function getNavigationData() { return { navigation, switchers, mdxParseErrors } }`,
        ].join('\n')
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
        // Only count non-queried .md/.mdx imports for the RenderImportedMdx wrapper.
        // Queried imports like README.md?raw are plain Vite imports, not MDX renders.
        const hasMdxImports = sortedImports.some(([moduleKey, absPath]) =>
          !moduleKey.includes('?') && /\.mdx?$/.test(absPath))
        const entries = sortedImports.map(([moduleKey, absPath]) => {
          // Vite query imports (?raw, ?url, ?inline, ?worker, etc.): forward the
          // query suffix to the import() call so Vite applies the right transform.
          const qIdx = moduleKey.indexOf('?')
          if (qIdx >= 0) {
            const querySuffix = moduleKey.slice(qIdx)
            return `  ${JSON.stringify(moduleKey)}: () => import(${JSON.stringify(absPath + querySuffix)})`
          }
          if (/\.mdx?$/.test(absPath)) {
            const baseUrl = './' + path.relative(root, path.dirname(absPath)).replace(/\\/g, '/') + '/'
            const source = './' + path.relative(root, absPath).replace(/\\/g, '/')
            return [
              `  ${JSON.stringify(moduleKey)}: async () => {`,
              `    const markdown = (await import(${JSON.stringify(absPath + '?raw')})).default`,
              `    return { default: function ImportedMdx(props) {`,
              `      return React.createElement(RenderImportedMdx, { ...props, markdown, baseUrl: ${JSON.stringify(baseUrl)}, source: ${JSON.stringify(source)} })`,
              `    } }`,
              `  }`,
            ].join('\n')
          }
          return `  ${JSON.stringify(moduleKey)}: () => import(${JSON.stringify(absPath)})`
        })

        return [
          hasMdxImports ? `import React from 'react'` : undefined,
          hasMdxImports ? `import { RenderImportedMdx } from '@holocron.so/vite/src/lib/mdx-components-map'` : undefined,
          `const modules = {`,
          entries.join(',\n'),
          `}`,
          `export function getModules() { return modules }`,
          `export const pagesDirPrefix = ${JSON.stringify(pagesDirPrefix)}`,
        ].filter(Boolean).join('\n')
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
      // Config file is read with fs.readFileSync (not imported), so Vite
      // wouldn't watch it by default. addWatchFile in load() registers it
      // as a dependency of the virtual module, but the file must also be
      // watched by chokidar to trigger change events.
      if (configFilePath) {
        server.watcher.add(configFilePath)
      }
      // User CSS is imported via the virtual app module, but the raw file
      // also needs to be watched by chokidar so edits trigger HMR.
      if (userCssPath) {
        server.watcher.add(userCssPath)
      }
      server.watcher.add(pagesDir)
    },

    // hotUpdate — per-environment HMR hook.
    //
    // MDX files are scanned by Tailwind through @source, not imported as real
    // JS modules. If ctx.modules only contains the raw .mdx asset module,
    // @tailwindcss/vite treats the edit as an external template change and
    // sends a full reload. Inject the virtual modules that own MDX rendering
    // (same pattern as vite:import-glob) so Tailwind lets Holocron handle HMR.
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

      if (!isMdx && !isConfig && !isImportableAddOrRemove) {
        return
      }

      if (isMdx && ctx.file.startsWith(pagesDir)) {
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
      const cssMods = this.environment.moduleGraph.getModulesByFile(HOLOCRON_GLOBALS_CSS_PATH)
      if (cssMods) {
        for (const mod of cssMods) {
          this.environment.moduleGraph.invalidateModule(mod)
        }
      }

      if (this.environment.name === 'client') {
        const cssUpdates = [...(this.environment.moduleGraph.getModulesByFile(HOLOCRON_GLOBALS_CSS_PATH) ?? [])]
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
  // The Prism registry now lives behind one Holocron package file, so users
  // only see a single optimizeDeps entry instead of one line per grammar.
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
          [
            '@holocron.so/vite > @orama/orama',
            '@holocron.so/vite > cookie',
            '@holocron.so/vite > prismjs',
            '@holocron.so/vite > mermaid',
            '@holocron.so/vite > react-medium-image-zoom',
            '@holocron.so/vite > zustand',
          ],
        )
      }

      if (name === 'client' || name === 'ssr') {
        addCodeSplittingGroups(config, [MERMAID_GROUP])
      }

      // Split stable deps (framework + node_modules) into their own chunk
      // so the RSC entry only contains virtual modules (~20KB). Maximizes
      // content-addressable dedup for holocron deploy.
      // RSC-only — SSR is self-contained and not dynamically imported.
      if (name === 'rsc') {
        addCodeSplittingGroups(config, [STABLE_GROUP])
      }

      if (name === 'rsc' || name === 'ssr') {
        addNoExternal(config, holocronPackagePattern)
        addNoExternal(config, 'fflate')
        config.optimizeDeps ??= {}
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
        && ctx.file.startsWith(pagesDir)
      if (!isMdx) return

      // @tailwindcss/vite also runs in `enforce: pre`. It full-reloads when
      // every module for a scanned file is an asset/no-id module. MDX pages are
      // scanned by @source but rendered through these virtual modules, so mark
      // the update as framework-owned before Tailwind's HMR hook runs.
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
