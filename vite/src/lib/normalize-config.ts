/**
 * Normalize raw docs.json/holocron.jsonc into canonical HolocronConfig.
 * Collapses all union variants (logo, favicon, navigation, navbar) so
 * consumers never deal with type discrimination.
 */

import type {
  HolocronConfig,
  ConfigIcon,
  ConfigAnchor,
  ConfigNavGroup,
  ConfigNavPageEntry,
  ConfigNavTab,
  ConfigNavbarLink,
  ConfigNavbarPrimary,
  ConfigVersionItem,
  ConfigDropdownItem,
  FooterLinkColumn,
} from '../config.ts'

/** Libraries we can actually resolve at build time. Object icons with
 *  unsupported libraries are stripped at normalize time so they fall
 *  through to the label fallback instead of silently rendering nothing. */
const SUPPORTED_ICON_LIBRARIES = new Set(['lucide'])

/** Validate an icon value and strip object icons whose library we can't
 *  resolve. Strings (emoji / URL / lucide names) always pass through.
 *  Returns the icon or undefined (meaning "no icon"). */
function sanitizeIcon(icon: ConfigIcon | undefined, context: string): ConfigIcon | undefined {
  if (!icon) return undefined
  if (typeof icon === 'string') return icon
  const library = icon.library ?? 'lucide'
  if (!SUPPORTED_ICON_LIBRARIES.has(library)) {
    console.warn(
      `[holocron] icon library "${library}" is not supported yet (only lucide). ` +
      `Icon "${icon.name}" in ${context} will be ignored.`,
    )
    return undefined
  }
  return icon
}

/** Known type → display label mapping for navbar items */
const TYPE_LABELS: Record<string, string> = {
  github: 'GitHub',
  discord: 'Discord',
  slack: 'Slack',
  button: 'Button',
  link: 'Link',
}

/** Known `type` → default lucide icon name. Applied when the user writes
 *  `{ type: 'github', href: '...' }` without an explicit `icon`, so the
 *  navbar link is never rendered invisible. Keys are aligned with the
 *  `socialPlatformKeys` list in schema.ts. All values verified to exist
 *  in @iconify-json/lucide. */
const TYPE_ICONS: Record<string, string> = {
  github: 'github',
  slack: 'slack',
  // lucide has no dedicated 'discord' icon — fall back to message-circle
  discord: 'message-circle',
  twitter: 'twitter',
  'x-twitter': 'twitter',
  // lucide 'x' is the close-X symbol, not the X/Twitter brand logo. Map
  // social type 'x' to the twitter glyph so users don't get a cross mark.
  x: 'twitter',
  linkedin: 'linkedin',
  youtube: 'youtube',
  facebook: 'facebook',
  instagram: 'instagram',
  website: 'globe',
  'earth-americas': 'globe',
  'hacker-news': 'newspaper',
  medium: 'book-open',
  telegram: 'send',
  bluesky: 'cloud',
  threads: 'at-sign',
  reddit: 'message-square',
  podcast: 'rss',
  button: 'external-link',
  link: 'external-link',
}

export function normalize(raw: Record<string, unknown>): HolocronConfig {
  return {
    name: (raw.name as string) || 'Documentation',
    description: typeof raw.description === 'string' ? raw.description : undefined,
    logo: normalizeLogo(raw.logo),
    favicon: normalizeFavicon(raw.favicon),
    colors: normalizeColors(raw.colors),
    appearance: normalizeAppearance(raw.appearance),
    fonts: normalizeFonts(raw.fonts),
    navigation: normalizeNavigation(raw.navigation),
    navbar: normalizeNavbar(raw.navbar),
    banner: normalizeBanner(raw.banner),
    redirects: normalizeRedirects(raw.redirects),
    footer: normalizeFooter(raw.footer),
    search: normalizeSearch(raw.search),
    seo: normalizeSeo(raw.seo),
  }
}

/** logo: string | { light, dark, href? } → { light, dark?, href? }
 *  `dark` is only set when the user explicitly provided a dark logo.
 *  Components use this to decide between dark:hidden/dark:block pair
 *  vs single img with dark:invert fallback. */
function normalizeLogo(raw: unknown): HolocronConfig['logo'] {
  if (!raw) {
    return { light: '' }
  }
  if (typeof raw === 'string') {
    return { light: raw }
  }
  const obj = raw as Record<string, string>
  return {
    light: obj.light || '',
    ...(obj.dark && obj.dark !== obj.light ? { dark: obj.dark } : {}),
    href: obj.href,
  }
}

/** favicon: string | { light, dark } → { light, dark } */
function normalizeFavicon(raw: unknown): HolocronConfig['favicon'] {
  if (!raw) {
    return { light: '', dark: '' }
  }
  if (typeof raw === 'string') {
    return { light: raw, dark: raw }
  }
  const obj = raw as Record<string, string>
  return {
    light: obj.light || '',
    dark: obj.dark || obj.light || '',
  }
}

function normalizeColors(raw: unknown): HolocronConfig['colors'] {
  if (!raw || typeof raw !== 'object') {
    return { primary: '#000000', _hasUserColors: false }
  }
  const obj = raw as Record<string, string>
  return {
    primary: obj.primary || '#000000',
    light: obj.light,
    dark: obj.dark,
    _hasUserColors: Boolean(obj.primary || obj.light || obj.dark),
  }
}

const EMPTY_NAV: HolocronConfig['navigation'] = { tabs: [], anchors: [], versions: [], dropdowns: [] }

/** Normalize inner navigation content (tabs/groups/pages) of a switcher item. */
function normalizeInnerNavigation(raw: Record<string, unknown>): { tabs: ConfigNavTab[]; anchors: ConfigAnchor[] } {
  const innerAnchors = Array.isArray(raw.anchors) ? raw.anchors as ConfigAnchor[] : []

  if (Array.isArray(raw.tabs)) {
    return normalizeTabsAndAnchors(raw.tabs as Array<Record<string, unknown>>, innerAnchors)
  }
  if (Array.isArray(raw.groups)) {
    return {
      tabs: [{ tab: '', groups: raw.groups as ConfigNavGroup[] }],
      anchors: innerAnchors,
    }
  }
  if (Array.isArray(raw.pages)) {
    return {
      tabs: [{ tab: '', groups: [{ group: '', pages: raw.pages as ConfigNavPageEntry[] }] }],
      anchors: innerAnchors,
    }
  }
  return { tabs: [], anchors: innerAnchors }
}

/** Normalize `navigation.versions` into ConfigVersionItem[].
 *  Versions with no inner content (no tabs/groups/pages) are dropped. */
function normalizeVersions(rawVersions: unknown[]): ConfigVersionItem[] {
  return rawVersions.flatMap((v) => {
    const obj = v as Record<string, unknown>
    const version = (obj.version as string) || ''
    const nav = normalizeInnerNavigation(obj)
    if (nav.tabs.length === 0) {
      console.warn(`[holocron] version "${version}" has no content — skipping.`)
      return []
    }
    return [{
      version,
      ...(obj.default === true && { default: true }),
      ...(typeof obj.tag === 'string' && { tag: obj.tag }),
      ...(obj.hidden === true && { hidden: true }),
      navigation: nav,
    }]
  })
}

/** Normalize `navigation.dropdowns` into ConfigDropdownItem[].
 *  Dropdowns with no href and no inner content are dropped. */
function normalizeDropdowns(rawDropdowns: unknown[]): ConfigDropdownItem[] {
  return rawDropdowns.flatMap((d) => {
    const obj = d as Record<string, unknown>
    const name = (obj.dropdown as string) || ''
    const icon = sanitizeIcon(obj.icon as ConfigIcon | undefined, `dropdown "${name}"`)
    const href = typeof obj.href === 'string' ? obj.href : undefined

    // Link-only dropdown (has href, no content)
    if (href && !obj.tabs && !obj.groups && !obj.pages) {
      const item: ConfigDropdownItem = {
        dropdown: name,
        ...(icon !== undefined && { icon }),
        ...(obj.hidden === true && { hidden: true }),
        href,
      }
      return [item]
    }

    const nav = normalizeInnerNavigation(obj)
    if (nav.tabs.length === 0 && !href) {
      console.warn(`[holocron] dropdown "${name}" has no content and no href — skipping.`)
      return []
    }

    const item: ConfigDropdownItem = {
      dropdown: name,
      ...(icon !== undefined && { icon }),
      ...(obj.hidden === true && { hidden: true }),
      ...(href ? { href } : {}),
      navigation: nav,
    }
    return [item]
  })
}

/** Normalize `navigation.products` → ConfigDropdownItem[] (product → dropdown). */
function normalizeProducts(rawProducts: unknown[]): ConfigDropdownItem[] {
  return normalizeDropdowns(
    rawProducts.map((p) => {
      const obj = p as Record<string, unknown>
      return {
        ...obj,
        dropdown: obj.product as string || '',
      }
    }),
  )
}

/** Normalize all navigation variants to { tabs, anchors, versions, dropdowns }.
 *  Version/dropdown inner tabs are flattened into the main tabs for routing. */
function normalizeNavigation(raw: unknown): HolocronConfig['navigation'] {
  if (!raw) {
    return EMPTY_NAV
  }

  // Array format
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return EMPTY_NAV
    }
    const first = raw[0]
    // Array of tabs
    if (first && typeof first === 'object' && 'tab' in first) {
      const base = normalizeTabsAndAnchors(raw as Array<Record<string, unknown>>, [])
      return { ...base, versions: [], dropdowns: [] }
    }
    // Array of groups → wrap in single implicit tab
    return {
      tabs: [{ tab: '', groups: raw as ConfigNavGroup[] }],
      anchors: [],
      versions: [],
      dropdowns: [],
    }
  }

  // Object format
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>

    // Collect anchors from both global.anchors and root anchors (with guards)
    const globalObj = obj.global as Record<string, unknown> | undefined
    const globalAnchors = Array.isArray(globalObj?.anchors) ? globalObj.anchors as ConfigAnchor[] : []
    const rootAnchors = Array.isArray(obj.anchors) ? obj.anchors as ConfigAnchor[] : []
    const allAnchors = [...globalAnchors, ...rootAnchors]

    // Normalize versions/dropdowns/products from the raw navigation
    const versions = Array.isArray(obj.versions) ? normalizeVersions(obj.versions) : []
    const dropdowns = [
      ...(Array.isArray(obj.dropdowns) ? normalizeDropdowns(obj.dropdowns) : []),
      ...(Array.isArray(obj.products) ? normalizeProducts(obj.products) : []),
    ]

    // Flatten version/dropdown inner tabs for routing. Inner anchors stay
    // scoped to their switcher item — only global/root anchors go here.
    const flatTabs: ConfigNavTab[] = []
    const flatAnchors: ConfigAnchor[] = [...allAnchors]

    for (const v of versions) {
      flatTabs.push(...v.navigation.tabs)
    }
    for (const d of dropdowns) {
      if (d.navigation) {
        flatTabs.push(...d.navigation.tabs)
      }
    }

    // Has versions/dropdowns/products as root organizational keys
    if (versions.length > 0 || dropdowns.length > 0) {
      // Also allow top-level tabs/groups/pages alongside versions/dropdowns
      if (Array.isArray(obj.tabs)) {
        const base = normalizeTabsAndAnchors(obj.tabs as Array<Record<string, unknown>>, [])
        flatTabs.push(...base.tabs)
        flatAnchors.push(...base.anchors)
      } else if (Array.isArray(obj.groups)) {
        flatTabs.push({ tab: '', groups: obj.groups as ConfigNavGroup[] })
      } else if (Array.isArray(obj.pages)) {
        flatTabs.push({ tab: '', groups: [{ group: '', pages: obj.pages as ConfigNavPageEntry[] }] })
      }

      return { tabs: flatTabs, anchors: flatAnchors, versions, dropdowns }
    }

    // Has explicit tabs (no versions/dropdowns)
    if (Array.isArray(obj.tabs)) {
      const base = normalizeTabsAndAnchors(obj.tabs as Array<Record<string, unknown>>, allAnchors)
      return { ...base, versions: [], dropdowns: [] }
    }

    // Root groups (no tabs wrapper)
    if (Array.isArray(obj.groups)) {
      return {
        tabs: [{ tab: '', groups: obj.groups as ConfigNavGroup[] }],
        anchors: allAnchors,
        versions: [],
        dropdowns: [],
      }
    }

    // Root pages (no groups wrapper)
    if (Array.isArray(obj.pages)) {
      return {
        tabs: [{ tab: '', groups: [{ group: '', pages: obj.pages as ConfigNavPageEntry[] }] }],
        anchors: allAnchors,
        versions: [],
        dropdowns: [],
      }
    }

    return { tabs: [], anchors: allAnchors, versions: [], dropdowns: [] }
  }

  return EMPTY_NAV
}

/**
 * Normalize raw tab objects into ConfigNavTab[] + extra anchors.
 * Handles tab variants:
 *   { tab, groups }  → kept as ConfigNavTab
 *   { tab, href }    → converted to anchor (link-only tab)
 *   { tab, pages }   → wrapped in a single group
 */
function normalizeTabsAndAnchors(
  rawTabs: Array<Record<string, unknown>>,
  existingAnchors: ConfigAnchor[],
): { tabs: ConfigNavTab[]; anchors: ConfigAnchor[] } {
  const tabs: ConfigNavTab[] = []
  const anchors: ConfigAnchor[] = [...existingAnchors]

  for (const raw of rawTabs) {
    const name = (raw.tab as string) || ''
    const icon = sanitizeIcon(raw.icon as ConfigIcon | undefined, `tab "${name}"`)

    const hidden = raw.hidden as boolean | undefined
    const align = raw.align as ('start' | 'end') | undefined
    const extras = {
      ...(icon !== undefined && { icon }),
      ...(hidden !== undefined && { hidden }),
    }
    const tabExtras = {
      ...extras,
      ...(align !== undefined && { align }),
    }

    // Link-only tab → convert to anchor
    if (raw.href && !raw.groups && !raw.pages) {
      anchors.push({
        anchor: name,
        href: raw.href as string,
        ...extras,
      })
      continue
    }

    // Tab with groups → standard content tab
    if (raw.groups) {
      tabs.push({ tab: name, ...tabExtras, groups: raw.groups as ConfigNavGroup[] })
      continue
    }

    // Tab with pages but no groups → wrap in single unnamed group
    if (raw.pages) {
      tabs.push({
        tab: name,
        ...tabExtras,
        groups: [{ group: '', pages: raw.pages as ConfigNavPageEntry[] }],
      })
      continue
    }

    // Tab with no content — skip
  }

  return { tabs, anchors }
}

/**
 * navbar can be:
 *   - { links: [{ label, href } | { type: "github", href }], primary: { label, href } | { type: "github", href } }
 *
 * Always normalize to { label, href }. Derive label from type if missing.
 */
function normalizeNavbar(raw: unknown): HolocronConfig['navbar'] {
  if (!raw || typeof raw !== 'object') {
    return { links: [] }
  }
  const obj = raw as Record<string, unknown>

  const rawLinks = (obj.links ?? []) as Array<Record<string, unknown>>
  const links: ConfigNavbarLink[] = rawLinks.map((link) => {
    const type = typeof link.type === 'string' ? link.type : undefined
    const label =
      (typeof link.label === 'string' && link.label) ||
      TYPE_LABELS[type || ''] ||
      type ||
      ''
    const href =
      (typeof link.href === 'string' && link.href) ||
      (typeof link.url === 'string' && link.url) ||
      ''
    // Auto-fill icon from type when user writes `{ type: 'github', href: ... }`
    // with no explicit icon. Without this, the navbar link would render
    // empty (only aria-label set) — the original "invisible github link" bug.
    const rawIcon = sanitizeIcon(
      link.icon as ConfigIcon | undefined,
      `navbar.links[${label || href}]`,
    )
    const icon: ConfigIcon | undefined =
      rawIcon !== undefined
        ? rawIcon
        : type && TYPE_ICONS[type]
          ? TYPE_ICONS[type]
          : undefined
    return {
      label,
      href,
      ...(type !== undefined && { type }),
      ...(icon !== undefined && { icon }),
    }
  })

  const rawPrimary = obj.primary as Record<string, unknown> | undefined
  let primary: ConfigNavbarPrimary | undefined
  if (rawPrimary) {
    const type = typeof rawPrimary.type === 'string' ? rawPrimary.type : undefined
    // Same auto-fill logic for primary CTA — a `type: 'github'` primary
    // button without an explicit icon should render the github glyph.
    const rawIcon = sanitizeIcon(
      rawPrimary.icon as ConfigIcon | undefined,
      'navbar.primary',
    )
    const icon: ConfigIcon | undefined =
      rawIcon !== undefined
        ? rawIcon
        : type && TYPE_ICONS[type]
          ? TYPE_ICONS[type]
          : undefined
    primary = {
      label:
        (typeof rawPrimary.label === 'string' && rawPrimary.label) ||
        TYPE_LABELS[type || ''] ||
        type ||
        'Button',
      href:
        (typeof rawPrimary.href === 'string' && rawPrimary.href) ||
        (typeof rawPrimary.url === 'string' && rawPrimary.url) ||
        '',
      ...(type !== undefined && { type }),
      ...(icon !== undefined && { icon }),
    }
  }

  return { links, primary }
}

function normalizeRedirects(raw: unknown): HolocronConfig['redirects'] {
  if (!Array.isArray(raw)) {
    return []
  }
  return raw.map((r: Record<string, unknown>) => {
    return {
      source: (r.source as string) || '',
      destination: (r.destination as string) || '',
      permanent: r.permanent as boolean | undefined,
    }
  })
}

function normalizeFooter(raw: unknown): HolocronConfig['footer'] {
  if (!raw || typeof raw !== 'object') {
    return { socials: {}, links: [] }
  }
  const obj = raw as Record<string, unknown>
  const socials = (obj.socials ?? {}) as Record<string, string>
  const rawLinks = Array.isArray(obj.links) ? obj.links : []
  const links: FooterLinkColumn[] = rawLinks.slice(0, 4).map((col: Record<string, unknown>) => ({
    header: typeof col.header === 'string' ? col.header : undefined,
    items: Array.isArray(col.items)
      ? col.items.map((item: Record<string, string>) => ({
          label: item.label || '',
          href: item.href || '',
        }))
      : [],
  }))
  return { socials, links }
}

function normalizeAppearance(raw: unknown): HolocronConfig['appearance'] {
  if (!raw || typeof raw !== 'object') {
    return { default: 'system', strict: false }
  }
  const obj = raw as Record<string, unknown>
  const def = obj.default
  return {
    default: def === 'light' || def === 'dark' ? def : 'system',
    strict: obj.strict === true,
  }
}

function normalizeFonts(raw: unknown): HolocronConfig['fonts'] {
  if (!raw || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  const normFontObj = (v: unknown): { family: string; weight?: number; source?: string; format?: 'woff' | 'woff2' } | undefined => {
    if (!v || typeof v !== 'object') return undefined
    const o = v as Record<string, unknown>
    if (typeof o.family !== 'string') return undefined
    return {
      family: o.family,
      weight: typeof o.weight === 'number' ? o.weight : undefined,
      source: typeof o.source === 'string' ? o.source : undefined,
      format: o.format === 'woff' || o.format === 'woff2' ? o.format : undefined,
    }
  }
  return {
    family: typeof obj.family === 'string' ? obj.family : undefined,
    weight: typeof obj.weight === 'number' ? obj.weight : undefined,
    source: typeof obj.source === 'string' ? obj.source : undefined,
    format: obj.format === 'woff' || obj.format === 'woff2' ? obj.format : undefined,
    heading: normFontObj(obj.heading),
    body: normFontObj(obj.body),
  }
}

function normalizeBanner(raw: unknown): HolocronConfig['banner'] {
  if (!raw || typeof raw !== 'object') return undefined
  const obj = raw as Record<string, unknown>
  if (typeof obj.content !== 'string' || !obj.content) return undefined
  return {
    content: obj.content,
    dismissible: obj.dismissible === true,
  }
}

function normalizeSearch(raw: unknown): HolocronConfig['search'] {
  if (!raw || typeof raw !== 'object') return { prompt: undefined }
  const obj = raw as Record<string, unknown>
  return {
    prompt: typeof obj.prompt === 'string' ? obj.prompt : undefined,
  }
}

function normalizeSeo(raw: unknown): HolocronConfig['seo'] {
  if (!raw || typeof raw !== 'object') return {}
  const obj = raw as Record<string, unknown>
  const indexing = obj.indexing === 'navigable' || obj.indexing === 'all' ? obj.indexing : undefined
  const metatags =
    obj.metatags && typeof obj.metatags === 'object'
      ? (obj.metatags as Record<string, string>)
      : undefined
  return { indexing, metatags }
}
