/**
 * Config override — types, merge logic, and DialKit conversion.
 *
 * Supports live customization of visual docs.json fields via a DialKit panel.
 * Overrides are stored in a Durable Object on holocron.so and referenced by
 * a cookie containing `<doId>:<configHash>`. The merge is always a full
 * snapshot applied on top of the base config, not a diff, so it works
 * correctly regardless of base config changes between deployments.
 *
 * Only visual/theming fields are overridable. Navigation, redirects,
 * knownPaths, seo, and integrations are excluded (structural/security-sensitive).
 */

import type { HolocronConfig } from '../config.ts'
import { parse as parseCookies } from 'cookie'
import { holocronUrl } from './holocron-url.ts'
import type { DialConfig } from 'dialkit'

/* ── Overridable subset ──────────────────────────────────────────────── */

export type ConfigOverride = {
  colors?: Partial<HolocronConfig['colors']>
  appearance?: Partial<HolocronConfig['appearance']>
  decorativeLines?: HolocronConfig['decorativeLines']
  banner?: Partial<NonNullable<HolocronConfig['banner']>>
  assistant?: Partial<HolocronConfig['assistant']>
  layout?: Partial<HolocronConfig['layout']>
  fonts?: Partial<NonNullable<HolocronConfig['fonts']>>
}

/* ── Merge ───────────────────────────────────────────────────────────── */

/** Deep-merge override fields into a base config. Returns a new object;
 *  never mutates `base`. Fields not present in `override` are left as-is. */
export function mergeConfigOverride(
  base: HolocronConfig,
  override: ConfigOverride,
): HolocronConfig {
  const merged = { ...base }

  if (override.colors) {
    merged.colors = { ...base.colors, ...override.colors, _hasUserColors: true }
  }
  if (override.appearance) {
    merged.appearance = { ...base.appearance, ...override.appearance }
  }
  if (override.decorativeLines !== undefined) {
    merged.decorativeLines = override.decorativeLines
  }
  if (override.banner) {
    merged.banner = base.banner
      ? { ...base.banner, ...override.banner }
      : { content: override.banner.content ?? '', dismissible: override.banner.dismissible ?? false }
  }
  if (override.assistant) {
    merged.assistant = { ...base.assistant, ...override.assistant }
  }
  if (override.layout) {
    merged.layout = { ...base.layout, ...override.layout }
  }
  if (override.fonts) {
    merged.fonts = {
      ...base.fonts,
      ...override.fonts,
      ...(override.fonts.heading && {
        heading: { ...base.fonts?.heading, ...override.fonts.heading } as NonNullable<HolocronConfig['fonts']>['heading'],
      }),
    }
  }

  return merged
}

/* ── Cookie parsing ──────────────────────────────────────────────────── */

export const CONFIG_OVERRIDE_COOKIE = 'holo-config-override'

/** Parse the override cookie into doId + hash. Returns null if absent or malformed. */
export function parseOverrideCookie(
  cookieHeader: string | null,
): { doId: string; hash: string } | null {
  if (!cookieHeader) return null
  const cookies = parseCookies(cookieHeader)
  const value = cookies[CONFIG_OVERRIDE_COOKIE]
  if (!value) return null
  const colonIdx = value.indexOf(':')
  if (colonIdx <= 0) return null
  const doId = value.slice(0, colonIdx)
  const hash = value.slice(colonIdx + 1)
  if (!doId || !hash) return null
  return { doId, hash }
}

/* ── Config → DialKit conversion ─────────────────────────────────────── */

/** Convert the current HolocronConfig into a DialKit config object.
 *  Each field maps to the appropriate DialKit control type. */
export function configToDialConfig(config: HolocronConfig): DialConfig {
  return {
    colors: {
      light: { type: 'color' as const, default: config.colors.dark || config.colors.primary || '#0D9373' },
      dark: { type: 'color' as const, default: config.colors.light || '#ffffff' },
    },
    layout: {
      maxWidth: [config.layout.maxWidth, 800, 2600, 50] as [number, number, number, number],
      radius: [config.layout.radius, 0, 20, 1] as [number, number, number, number],
    },

    fonts: {
      bodySize: [config.fonts?.fontSize ?? 14, 12, 18, 1] as [number, number, number, number],
      headingSize: [config.fonts?.heading?.fontSize ?? 16, 12, 36, 1] as [number, number, number, number],
    },
    decorativeLines: {
      type: 'select' as const,
      options: ['none', 'lines', 'dashed', 'lines-with-dots'],
      default: config.decorativeLines,
    },
    assistant: {
      enabled: config.assistant.enabled,
    },
    actions: {
      copy: { type: 'action' as const },
      reset: { type: 'action' as const },
    },

  }
}

/** Convert DialKit reactive values back to a ConfigOverride. */
export function dialValuesToOverride(values: Record<string, any>): ConfigOverride {
  const override: ConfigOverride = {}

  if (values.colors) {
    override.colors = {}
    // DialKit shows light/dark labels matching the mode they appear in:
    // "light" = color used in light mode (Mintlify's colors.dark)
    // "dark" = color used in dark mode (Mintlify's colors.light)
    if (values.colors.light) {
      override.colors.primary = values.colors.light
      override.colors.dark = values.colors.light
    }
    if (values.colors.dark) override.colors.light = values.colors.dark
  }

  if (values.layout) {
    override.layout = {}
    if (values.layout.maxWidth !== undefined) override.layout.maxWidth = values.layout.maxWidth
    if (values.layout.radius !== undefined) override.layout.radius = values.layout.radius
  }

  if (values.fonts) {
    override.fonts = {}
    if (values.fonts.bodySize !== undefined) override.fonts.fontSize = values.fonts.bodySize
    if (values.fonts.headingSize !== undefined) {
      override.fonts.heading = { ...override.fonts.heading, fontSize: values.fonts.headingSize } as any
    }
  }

  if (values.decorativeLines !== undefined) {
    override.decorativeLines = values.decorativeLines
  }

  if (values.assistant) {
    override.assistant = {}
    if (values.assistant.enabled !== undefined) {
      override.assistant.enabled = values.assistant.enabled
    }
  }

  return override
}

/** Produce a clean docs.json-shaped partial object for clipboard export.
 *  Only includes fields that differ from defaults. */
export function configOverrideToDocsJsonPartial(override: ConfigOverride): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (override.colors) {
    const colors: Record<string, string> = {}
    if (override.colors.primary) colors.primary = override.colors.primary
    if (override.colors.light) colors.light = override.colors.light
    if (override.colors.dark) colors.dark = override.colors.dark
    if (Object.keys(colors).length > 0) result.colors = colors
  }

  if (override.appearance) {
    const appearance: Record<string, unknown> = {}
    if (override.appearance.default) appearance.default = override.appearance.default
    if (override.appearance.strict !== undefined) appearance.strict = override.appearance.strict
    if (Object.keys(appearance).length > 0) result.appearance = appearance
  }

  if (override.decorativeLines !== undefined) {
    result.decorativeLines = override.decorativeLines
  }

  if (override.banner) {
    const banner: Record<string, unknown> = {}
    if (override.banner.content !== undefined) banner.content = override.banner.content
    if (override.banner.dismissible !== undefined) banner.dismissible = override.banner.dismissible
    if (Object.keys(banner).length > 0) result.banner = banner
  }

  if (override.assistant) {
    if (override.assistant.enabled !== undefined) {
      result.assistant = { enabled: override.assistant.enabled }
    }
  }

  if (override.layout) {
    const layout: Record<string, unknown> = {}
    if (override.layout.maxWidth !== undefined) layout.maxWidth = override.layout.maxWidth
    if (override.layout.radius !== undefined) layout.radius = override.layout.radius
    if (override.layout.sidebarWidth !== undefined) layout.sidebarWidth = override.layout.sidebarWidth
    if (override.layout.columnGap !== undefined) layout.columnGap = override.layout.columnGap
    if (Object.keys(layout).length > 0) result.layout = layout
  }

  if (override.fonts) {
    const fonts: Record<string, unknown> = {}
    if (override.fonts.fontSize !== undefined) fonts.fontSize = override.fonts.fontSize
    if (override.fonts.heading?.fontSize !== undefined) {
      fonts.heading = { fontSize: override.fonts.heading.fontSize }
    }
    if (Object.keys(fonts).length > 0) result.fonts = fonts
  }

  return result
}

/* ── Resolve override from cookie (server-side) ──────────────────────── */

/** In-memory cache for resolved overrides. Keys are `doId:hash` strings.
 *  Since the hash is derived from the override content, same key = same
 *  config forever. Safe to cache indefinitely within a process lifetime. */
const overrideCache = new Map<string, ConfigOverride>()

/** Fetch the config override from the holocron.so DO and merge it into
 *  the base config. Returns the base config unchanged if no cookie is
 *  present or the fetch fails. Caches results in-process by key. */
export async function resolveConfigOverride(
  request: Request,
  baseConfig: HolocronConfig,
): Promise<HolocronConfig> {
  const parsed = parseOverrideCookie(request.headers.get('cookie'))
  if (!parsed) return baseConfig

  const cacheKey = `${parsed.doId}:${parsed.hash}`

  const cached = overrideCache.get(cacheKey)
  if (cached) return mergeConfigOverride(baseConfig, cached)

  try {
    const res = await fetch(
      holocronUrl(`/api/config-override/${encodeURIComponent(parsed.doId)}/${encodeURIComponent(parsed.hash)}`),
    )
    if (!res.ok) return baseConfig
    const override = (await res.json()) as ConfigOverride
    overrideCache.set(cacheKey, override)
    return mergeConfigOverride(baseConfig, override)
  } catch {
    return baseConfig
  }
}

/* ── Preview subdomain detection ─────────────────────────────────────── */

/** Whether the config panel should be shown for this request.
 *  True in dev mode and on holocron.so preview deployment subdomains. */
export function shouldShowConfigPanel(request: Request): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true
  try {
    const hostname = new URL(request.url).hostname
    // Matches preview deployment subdomains like mysite-site-preview.holocron.so,
    // the main preview site preview.holocron.so, and any sub-subdomain of it.
    return hostname.endsWith('-site-preview.holocron.so')
      || hostname === 'preview.holocron.so'
      || hostname.endsWith('.preview.holocron.so')
  } catch {
    return false
  }
}
