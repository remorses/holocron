/**
 * Runtime-safe navigation builder and data chunk generator.
 *
 * buildNavigationData: enriched nav tree from config + async MDX loaders.
 * generateHolocronData: produces the JS source files for holocron-data.js
 * and per-page chunks, ready to write to the deploy artifact directory.
 *
 * Neither function touches the filesystem, git, or Vite.
 */

import { createHash } from 'node:crypto'
import type { HolocronConfig } from './config.ts'
import { slugToHref, type NavPage } from './navigation.ts'
import { processMdx } from './lib/mdx-processor.ts'
import { collectIconRefs } from './lib/collect-icons.ts'
import { buildEnrichedNavigation, type EnrichedNavigationData } from './lib/enrich-navigation.ts'

export type HolocronNavigationData = EnrichedNavigationData

export async function buildNavigationData({
  config,
  getMdxSource,
}: {
  config: HolocronConfig
  getMdxSource(slug: string): Promise<string | undefined>
}): Promise<HolocronNavigationData> {
  async function enrichPage(slug: string): Promise<NavPage> {
    const content = await getMdxSource(slug)
    if (content === undefined) {
      throw new Error(`[holocron] custom navigation builder could not load MDX for page "${slug}"`)
    }
    const pageSource = slug === 'index' ? '/' : `/${slug}`
    const processed = processMdx(content, config.icons.library, pageSource)
    // In the custom virtual modules path, parse errors are fatal — no
    // sync cache to store them in, so propagate as a thrown error.
    if (processed instanceof Error) throw processed
    return {
      slug,
      href: slugToHref(slug),
      title: processed.title,
      description: processed.description,
      gitSha: '',
      headings: processed.headings,
      ...(processed.icon && { icon: processed.icon }),
      frontmatter: processed.frontmatter,
    }
  }
  return await buildEnrichedNavigation({ config, enrichPage })
}

/** Filename for a per-page chunk. Same hash logic as vite-plugin.ts chunkFileNames. */
function pageChunkFilename(slug: string): string {
  const readable = slug.replace(/\//g, '--')
  const hash = createHash('sha256').update(slug).digest('hex').slice(0, 8)
  return `holocron-page-${readable}-${hash}.js`
}

export type GenerateHolocronDataResult = {
  /** JS source for assets/holocron-data.js — drop-in replacement. */
  dataChunkSource: string
  /** Per-page JS chunks. Key is the slug, value has filename + source. */
  pageChunks: Map<string, { filename: string; source: string }>
}

/**
 * Generate the JS source files that make up a holocron deployment's
 * data layer. Produces a drop-in `holocron-data.js` and one
 * `holocron-page-{slug}-{hash}.js` per page.
 *
 * This is the entry point for multi-tenant pipelines: build once with
 * `vite build`, then call this per tenant to swap config + content
 * without rebuilding.
 *
 * No filesystem, Vite, or git access. The caller provides config and
 * MDX content via callbacks.
 */
export async function generateHolocronData({
  config,
  getMdxSource,
  slugs,
  base = '/',
}: {
  /** Normalized config (from `normalizeConfig(rawDocsJson)`). */
  config: HolocronConfig
  /** Async loader that returns raw MDX content for a slug. */
  getMdxSource(slug: string): Promise<string>
  /** All page slugs to include in the build. */
  slugs: string[]
  /** Base path (default: "/"). */
  base?: string
}): Promise<GenerateHolocronDataResult> {
  // Process each page: normalize MDX and extract metadata
  const processedPages = new Map<string, string>()
  const pageIconRefs: Record<string, string[]> = {}

  for (const slug of slugs) {
    const raw = await getMdxSource(slug)
    const pageSource = slug === 'index' ? '/' : `/${slug}`
    const processed = processMdx(raw, config.icons.library, pageSource)
    if (processed instanceof Error) throw processed
    processedPages.set(slug, processed.normalizedContent)
    pageIconRefs[slug] = processed.iconRefs
  }

  // Build enriched navigation tree
  const navData = await buildNavigationData({
    config,
    getMdxSource: async (slug) => {
      const content = await getMdxSource(slug)
      return content
    },
  })

  // Build per-page chunks
  const pageChunks = new Map<string, { filename: string; source: string }>()
  for (const slug of slugs) {
    const content = processedPages.get(slug)!
    const filename = pageChunkFilename(slug)
    pageChunks.set(slug, {
      filename,
      source: `var content = ${JSON.stringify(content)};\nexport default content;\n`,
    })
  }

  // Build the loader map entries
  const sortedSlugs = [...slugs].sort()
  const loaderEntries = sortedSlugs.map((slug) => {
    const filename = pageChunkFilename(slug)
    return `  ${JSON.stringify(slug)}: () => import("./${filename}").then((m) => m.default)`
  })

  // Collect all icon refs
  const allMdxIconRefs = Object.values(pageIconRefs).flat()
  const _iconRefs = collectIconRefs({
    config,
    navigation: navData.navigation,
    mdxIconRefs: allMdxIconRefs,
  })

  // Assemble holocron-data.js source
  const dataChunkSource = [
    `// Generated by generateHolocronData — do not edit by hand.`,
    ``,
    `// virtual:holocron-config`,
    `var config = ${JSON.stringify(config)};`,
    `export async function getConfig() { return config; }`,
    `export var base = ${JSON.stringify(base)};`,
    ``,
    `// virtual:holocron-navigation`,
    `var navigation = ${JSON.stringify(navData.navigation)};`,
    `var switchers = ${JSON.stringify(navData.switchers)};`,
    `var mdxParseErrors = {};`,
    `export function getNavigationData() { return { navigation, switchers, mdxParseErrors }; }`,
    ``,
    `// virtual:holocron-mdx`,
    `var slugs = ${JSON.stringify(sortedSlugs)};`,
    `var pageIconRefs = ${JSON.stringify(pageIconRefs)};`,
    `var loaders = {`,
    loaderEntries.join(',\n'),
    `};`,
    `export function getMdxSlugs() { return slugs; }`,
    `export async function getMdxSource(slug) {`,
    `  var load = loaders[slug];`,
    `  return load ? await load() : undefined;`,
    `}`,
    `export function getPageIconRefs(slug) { return pageIconRefs[slug] || []; }`,
    ``,
    `// virtual:holocron-modules`,
    `var modules = {};`,
    `export function getModules() { return modules; }`,
    `export var pagesDirPrefix = "./";`,
    ``,
  ].join('\n')

  return { dataChunkSource, pageChunks }
}
