/**
 * Runtime-safe navigation builder for custom virtual modules.
 *
 * Builds the enriched navigation tree from normalized config + async MDX
 * source loaders without touching build-only caches, image processing, or git.
 */

import type { HolocronConfig } from './config.ts'
import { slugToHref, type NavPage } from './navigation.ts'
import { processMdx } from './lib/mdx-processor.ts'
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
