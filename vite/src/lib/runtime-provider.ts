/**
 * Custom tab provider interface and runtime orchestration.
 *
 * A custom tab provider is a user-defined (or built-in) module that generates
 * navigation groups + MDX page content from an external source. It supports
 * two modes controlled by the `static` flag:
 *
 *   static: true (default)
 *     generate() runs at BUILD time during sync, same as OpenAPI/changelog.
 *     Content goes through the full enrichment pipeline (headings, images,
 *     sharp placeholders, icon collection). Pages are baked into virtual
 *     modules.
 *
 *   static: false
 *     generate() runs at REQUEST time and its result is cached with a
 *     configurable TTL. Pages appear without rebuilding when the external
 *     source publishes new content. Skips build-time enrichment.
 *
 * Config usage:
 *   { "tab": "Blog", "provider": "./providers/blog.ts", "base": "blog" }
 *
 * The provider file default-exports a CustomTabProvider object.
 */

import type { ConfigNavGroup, ConfigNavTab } from '../config.ts'
import type { RuntimeCache } from './runtime-cache.ts'
import type { VirtualTabResult } from './virtual-tab-provider.ts'
import { logger, formatHolocronWarning } from './logger.ts'

/**
 * Unified provider interface for custom tab providers.
 *
 * Users export this from their provider file. The `static` flag controls
 * whether generate() runs at build time or request time.
 */
export type CustomTabProvider = {
  /** Human-readable name for logs. */
  name: string

  /** When true (default), generate() runs at build time during sync.
   *  When false, generate() runs at request time and the result is cached. */
  static?: boolean

  /** Cache TTL in milliseconds. Only used when `static: false`.
   *  Defaults to 1 hour (3_600_000). */
  ttlMs?: number

  /** Generate navigation groups + MDX page content.
   *  Called at build time (static: true) or request time (static: false). */
  generate(ctx: {
    tab: ConfigNavTab
    projectRoot?: string
    pagesDir?: string
  }): Promise<VirtualTabResult>
}

/** Backwards-compatible alias. Internal code uses this for runtime providers. */
export type RuntimeVirtualTabProvider = CustomTabProvider

const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hour

/** Cache key for a runtime provider's full result. */
function cacheKey(providerName: string, tabName: string): string {
  return `runtime-provider:${providerName}:${tabName}`
}

/** Cached result shape stored in RuntimeCache. */
type CachedResult = {
  groups: ConfigNavGroup[]
  mdxContent: Record<string, string>
}

/**
 * Resolve a runtime provider's cached result, calling generate() on miss.
 * Returns the full VirtualTabResult (groups + mdxContent).
 * Uses promise coalescing: concurrent requests for the same key share one
 * in-flight generate() call instead of duplicating work.
 */
const inflight = new Map<string, Promise<CachedResult>>()

export async function resolveRuntimeResult(
  provider: CustomTabProvider,
  tabInfo: { tab: string; base?: string },
  cache: RuntimeCache,
): Promise<CachedResult> {
  const key = cacheKey(provider.name, tabInfo.tab)
  const cached = await cache.get<CachedResult>(key)
  if (cached) return cached

  // Coalesce concurrent cache misses: reuse the in-flight promise
  const existing = inflight.get(key)
  if (existing) return existing

  const ttl = provider.ttlMs ?? DEFAULT_TTL_MS
  const promise = (async (): Promise<CachedResult> => {
    try {
      const result = await provider.generate({ tab: { tab: tabInfo.tab, base: tabInfo.base } as ConfigNavTab })
      const toCache: CachedResult = {
        groups: result.groups,
        mdxContent: result.mdxContent,
      }
      await cache.set(key, toCache, ttl)
      return toCache
    } catch (err) {
      logger.warn(
        formatHolocronWarning(
          `Runtime provider "${provider.name}" failed for tab "${tabInfo.tab}": ${err instanceof Error ? err.message : String(err)}`,
        ),
      )
      return { groups: [], mdxContent: {} }
    }
  })()

  inflight.set(key, promise)
  promise.finally(() => inflight.delete(key))
  return promise
}

/**
 * Resolve MDX content for a specific slug from a runtime provider.
 * `configTabs` is the full tabs array from config (used to look up base path).
 */
export async function resolveRuntimeContent(
  slug: string,
  runtimeTabs: Map<string, CustomTabProvider>,
  configTabs: ConfigNavTab[],
  cache: RuntimeCache,
): Promise<{ mdx: string; groups: ConfigNavGroup[]; tabName: string } | undefined> {
  for (const [tabName, provider] of runtimeTabs) {
    const configTab = configTabs.find((t) => t.tab === tabName)
    const base = configTab?.base ?? provider.name
    if (base && !slug.startsWith(base + '/') && slug !== base) continue
    if (!base && slug.includes('/')) continue

    const result = await resolveRuntimeResult(provider, { tab: tabName, base }, cache)
    const mdx = result.mdxContent[slug]
    if (mdx !== undefined) {
      return { mdx, groups: result.groups, tabName }
    }
  }
  return undefined
}

/**
 * Merge runtime provider navigation into the base config tabs.
 * Uses tab name for matching (stable across clones).
 */
export async function mergeRuntimeNavigation(
  baseTabs: ConfigNavTab[],
  runtimeTabs: Map<string, CustomTabProvider>,
  cache: RuntimeCache,
): Promise<ConfigNavTab[]> {
  if (runtimeTabs.size === 0) return baseTabs

  const merged = baseTabs.map((tab) => {
    if (!runtimeTabs.has(tab.tab)) return tab
    return { ...tab }
  })

  await Promise.all(
    merged.map(async (tab, idx) => {
      const provider = runtimeTabs.get(tab.tab)
      if (!provider) return
      const result = await resolveRuntimeResult(provider, { tab: tab.tab, base: tab.base }, cache)
      merged[idx] = { ...tab, groups: result.groups }
    }),
  )

  return merged
}
