/**
 * Virtual tab provider interface.
 *
 * A virtual tab provider generates navigation groups and MDX page content
 * from an external source (OpenAPI spec, GitHub releases, etc.) without
 * requiring on-disk MDX files.
 *
 * sync.ts loops over registered providers for each tab. If a provider
 * claims a tab (its source field is present), it generates groups + virtual
 * MDX pages that flow through the same enrichment/render pipeline as real pages.
 *
 * Slug collision detection and multi-claimer guards are centralized in
 * processVirtualTabs() so providers don't need to coordinate with each other.
 *
 * To add a new provider:
 * 1. Add a schema variant in schema.ts (e.g. tabWithChangelogSchema)
 * 2. Add the source field to ConfigNavTab in config.ts
 * 3. Normalize it in normalize-config.ts (carry the field, empty groups)
 * 4. Implement VirtualTabProvider in a new file (e.g. changelog/provider.ts)
 * 5. Register it in sync.ts's providers array
 */

import type { ConfigNavGroup, ConfigNavTab } from '../config.ts'

export type VirtualTabResult = {
  groups: ConfigNavGroup[]
  /** slug → virtual MDX string */
  mdxContent: Record<string, string>
}

export type VirtualTabProvider = {
  /** Human-readable name for error messages (e.g. 'openapi', 'changelog'). */
  name: string

  /**
   * Check whether this provider should handle the given tab.
   * Return true if the tab has the provider's source field (e.g. tab.openapi).
   */
  claims(tab: ConfigNavTab): boolean

  /**
   * Generate groups and virtual MDX pages for the tab.
   *
   * The provider does NOT need to check for slug collisions — that is handled
   * centrally by processVirtualTabs() after generate() returns.
   */
  generate(ctx: {
    tab: ConfigNavTab
    projectRoot: string
    pagesDir: string
  }): Promise<VirtualTabResult>
}

/**
 * Process all virtual tab providers for the given config.
 *
 * For each tab, exactly one provider may claim it. If multiple providers
 * claim the same tab, an error is thrown. The provider's generated groups
 * replace the tab's empty groups, and virtual MDX pages are merged into
 * the shared mdxContent map. Slug collisions across providers are detected
 * centrally.
 */
export async function processVirtualTabs({
  config,
  projectRoot,
  pagesDir,
  mdxContent,
  providers,
}: {
  config: { navigation: { tabs: ConfigNavTab[] } }
  projectRoot: string
  pagesDir: string
  mdxContent: Record<string, string>
  providers: VirtualTabProvider[]
}): Promise<void> {
  // Shared slug registry for cross-provider collision detection
  const claimedSlugs = new Map<string, string>()

  for (const tab of config.navigation.tabs) {
    const claimers = providers.filter((p) => p.claims(tab))

    if (claimers.length > 1) {
      throw new Error(
        `[holocron] multiple virtual tab providers claimed tab "${tab.tab}": ` +
        claimers.map((p) => p.name).join(', '),
      )
    }

    const provider = claimers[0]
    if (!provider) continue

    const result = await provider.generate({ tab, projectRoot, pagesDir })

    // Centralized slug collision detection across all providers
    for (const slug of Object.keys(result.mdxContent)) {
      const existing = claimedSlugs.get(slug)
      if (existing) {
        throw new Error(
          `[holocron] duplicate virtual page slug "${slug}" from provider "${provider.name}". ` +
          `Conflicts with ${existing}.`,
        )
      }
      claimedSlugs.set(slug, `${provider.name} (tab "${tab.tab}")`)
    }

    // Merge virtual MDX into the shared content map
    Object.assign(mdxContent, result.mdxContent)

    // Replace the empty placeholder groups with the generated ones
    tab.groups = result.groups
  }
}
