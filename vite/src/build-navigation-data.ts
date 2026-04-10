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
    const processed = processMdx(content, config.icons.library)
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
