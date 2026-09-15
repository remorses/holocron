/**
 * Config override — types and merge logic.
 *
 * Supports live customization of docs.json fields for the dashboard preview:
 * any docs.json field can be overridden. The override key is passed via
 * `?configOverride=<doId>:<hash>` query param from the parent iframe, then
 * set as a cookie by a postMessage listener for subsequent router.refresh()
 * calls.
 *
 * Overrides are stored in a Durable Object on holocron.so. The merge is
 * always a full snapshot applied on top of the base config, not a diff.
 */

import type { HolocronConfig } from '../config.ts'
import { parse as parseCookies } from 'cookie'
import { holocronUrl } from './holocron-url.ts'

/* ── Iframe postMessage protocol ──────────────────────────────────────
 *
 * Typed messages exchanged between the notaku dashboard (parent) and the
 * holocron docs site (iframe child) for live config preview.
 *
 * Parent → Child:
 *   ConfigOverrideMessage      — apply a new override key
 *   ConfigOverrideClearMessage  — revert to base deployed config
 *
 * Child → Parent (acks):
 *   ConfigOverrideAckMessage       — confirms override was applied
 *   ConfigOverrideClearAckMessage  — confirms override was cleared
 * ──────────────────────────────────────────────────────────────────────── */

/** Parent → child: apply a config override by key. */
export type ConfigOverrideMessage = {
  type: 'config-override'
  /** The `doId:hash` key returned by POST /api/config-override. */
  key: string
}

/** Parent → child: clear the config override, revert to base config. */
export type ConfigOverrideClearMessage = {
  type: 'config-override-clear'
}

/** Child → parent: acknowledges the override was applied. */
export type ConfigOverrideAckMessage = {
  type: 'config-override-ack'
  key: string
}

/** Child → parent: acknowledges the override was cleared. */
export type ConfigOverrideClearAckMessage = {
  type: 'config-override-clear-ack'
}

/** All messages the iframe child accepts from the parent. */
export type ConfigOverrideInboundMessage =
  | ConfigOverrideMessage
  | ConfigOverrideClearMessage

/** All messages the iframe child sends back to the parent. */
export type ConfigOverrideOutboundMessage =
  | ConfigOverrideAckMessage
  | ConfigOverrideClearAckMessage

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

/* ── Merge (visual-only overrides) ────────────────────────────────────── */

/** Deep-merge visual override fields into a base config. Returns a new
 *  object; never mutates `base`. Only handles the known visual/theming
 *  fields (colors, appearance, layout, fonts, etc). Full-config overrides
 *  are handled separately by normalizing the raw JSON via `applyOverride()`. */
export function mergeConfigOverride(
  base: HolocronConfig,
  override: ConfigOverride | Record<string, unknown>,
): HolocronConfig {
  const merged = { ...base }

  const typedOverride = override as ConfigOverride
  if (typedOverride.colors) {
    merged.colors = { ...base.colors, ...typedOverride.colors, _hasUserColors: true }
  }
  if (typedOverride.appearance) {
    merged.appearance = { ...base.appearance, ...typedOverride.appearance }
  }
  if (typedOverride.decorativeLines !== undefined) {
    merged.decorativeLines = typedOverride.decorativeLines
  }
  if (typedOverride.banner) {
    merged.banner = base.banner
      ? { ...base.banner, ...typedOverride.banner }
      : { content: typedOverride.banner.content ?? '', dismissible: typedOverride.banner.dismissible ?? false }
  }
  if (typedOverride.assistant) {
    merged.assistant = { ...base.assistant, ...typedOverride.assistant }
  }
  if (typedOverride.layout) {
    merged.layout = { ...base.layout, ...typedOverride.layout }
  }
  if (typedOverride.fonts) {
    merged.fonts = {
      ...base.fonts,
      ...typedOverride.fonts,
      ...(typedOverride.fonts.heading && {
        heading: { ...base.fonts?.heading, ...typedOverride.fonts.heading } as NonNullable<HolocronConfig['fonts']>['heading'],
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

/* ── Parse override key from query param ─────────────────────────────── */

/** Parse the `configOverride` query parameter into doId + hash.
 *  Used by the notaku dashboard iframe.src approach: the parent sets
 *  `?configOverride=doId:hash` on the iframe URL, and the loader
 *  reads it here. No cookies or postMessage needed. */
function parseOverrideParam(
  url: string,
): { doId: string; hash: string } | null {
  try {
    const u = new URL(url)
    const value = u.searchParams.get('configOverride')
    if (!value) return null
    const colonIdx = value.indexOf(':')
    if (colonIdx <= 0) return null
    const doId = value.slice(0, colonIdx)
    const hash = value.slice(colonIdx + 1)
    if (!doId || !hash) return null
    return { doId, hash }
  } catch {
    return null
  }
}

/* ── Resolve override from query param or cookie (server-side) ────────── */

/** In-memory cache for resolved overrides. Keys are `doId:hash` strings.
 *  Since the hash is derived from the override content, same key = same
 *  config forever. Safe to cache indefinitely within a process lifetime. */
const overrideCache = new Map<string, ConfigOverride | Record<string, unknown>>()

/** Fetch the config override from the holocron.so DO and apply it to
 *  the base config.
 *
 *  Checks two sources for the override key (first match wins):
 *  1. `?configOverride=doId:hash` query param (dashboard iframe src)
 *  2. `holo-config-override` cookie (set by the postMessage listener)
 *
 *  Full-mode overrides (marked with `_mode: 'full'`) are normalized
 *  from raw docs.json into a complete HolocronConfig, replacing the
 *  base config entirely. Visual-only overrides are merged on top. */
export async function resolveConfigOverride(
  request: Request,
  baseConfig: HolocronConfig,
  normalizeConfig?: (raw: Record<string, unknown>) => HolocronConfig,
): Promise<HolocronConfig> {
  const parsed = parseOverrideParam(request.url)
    || parseOverrideCookie(request.headers.get('cookie'))
  if (!parsed) return baseConfig

  const cacheKey = `${parsed.doId}:${parsed.hash}`

  const cached = overrideCache.get(cacheKey)
  if (cached) {
    return applyOverride(baseConfig, cached, normalizeConfig)
  }

  try {
    const res = await fetch(
      holocronUrl(`/api/config-override/${encodeURIComponent(parsed.doId)}/${encodeURIComponent(parsed.hash)}`),
    )
    if (!res.ok) return baseConfig
    const override = (await res.json()) as Record<string, unknown>
    overrideCache.set(cacheKey, override)
    return applyOverride(baseConfig, override, normalizeConfig)
  } catch {
    return baseConfig
  }
}

/** Apply an override: full-mode overrides get normalized into a complete
 *  config (replacing the base), visual overrides get merged on top. */
function applyOverride(
  baseConfig: HolocronConfig,
  override: ConfigOverride | Record<string, unknown>,
  normalizeConfig?: (raw: Record<string, unknown>) => HolocronConfig,
): HolocronConfig {
  // Full-mode overrides are stored with `_mode: 'full'` marker
  if ((override as Record<string, unknown>)._mode === 'full' && normalizeConfig) {
    const { _mode, ...rawConfig } = override as Record<string, unknown>
    return normalizeConfig(rawConfig)
  }
  return mergeConfigOverride(baseConfig, override)
}
