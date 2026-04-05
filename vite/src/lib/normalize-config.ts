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
} from '../config.ts'

/** Known type → display label mapping for navbar items */
const TYPE_LABELS: Record<string, string> = {
  github: 'GitHub',
  discord: 'Discord',
  slack: 'Slack',
  button: 'Button',
  link: 'Link',
}

export function normalize(raw: Record<string, unknown>): HolocronConfig {
  return {
    name: (raw.name as string) || 'Documentation',
    description: typeof raw.description === 'string' ? raw.description : undefined,
    logo: normalizeLogo(raw.logo),
    favicon: normalizeFavicon(raw.favicon),
    colors: normalizeColors(raw.colors),
    navigation: normalizeNavigation(raw.navigation),
    navbar: normalizeNavbar(raw.navbar),
    redirects: normalizeRedirects(raw.redirects),
    footer: normalizeFooter(raw.footer),
  }
}

/** logo: string | { light, dark, href? } → { light, dark, href? } */
function normalizeLogo(raw: unknown): HolocronConfig['logo'] {
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
    return { primary: '#000000' }
  }
  const obj = raw as Record<string, string>
  return {
    primary: obj.primary || '#000000',
    light: obj.light,
    dark: obj.dark,
  }
}

/**
 * navigation can be:
 *   - Object { tabs, global: { anchors }, anchors }  (docs.json format)
 *   - Object { groups }                               (docs.json root groups)
 *   - Object { pages }                                (docs.json root pages)
 *   - Array of tabs [{ tab, groups }]
 *   - Array of groups [{ group, pages }]
 *
 * Tabs themselves can be:
 *   - { tab, groups }  → content tab with sidebar groups
 *   - { tab, href }    → link-only tab (converted to anchor)
 *   - { tab, pages }   → tab with pages but no groups wrapper
 *
 * Always normalize to { tabs: ConfigNavTab[], anchors: ConfigAnchor[] }
 */
function normalizeNavigation(raw: unknown): HolocronConfig['navigation'] {
  if (!raw) {
    return { tabs: [], anchors: [] }
  }

  // Array format
  if (Array.isArray(raw)) {
    if (raw.length === 0) {
      return { tabs: [], anchors: [] }
    }
    const first = raw[0]
    // Array of tabs
    if (first && typeof first === 'object' && 'tab' in first) {
      return normalizeTabsAndAnchors(raw as Array<Record<string, unknown>>, [])
    }
    // Array of groups → wrap in single implicit tab
    return {
      tabs: [{ tab: '', groups: raw as ConfigNavGroup[] }],
      anchors: [],
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

    // Has explicit tabs
    if (Array.isArray(obj.tabs)) {
      return normalizeTabsAndAnchors(obj.tabs as Array<Record<string, unknown>>, allAnchors)
    }

    // Root groups (no tabs wrapper)
    if (Array.isArray(obj.groups)) {
      return {
        tabs: [{ tab: '', groups: obj.groups as ConfigNavGroup[] }],
        anchors: allAnchors,
      }
    }

    // Root pages (no groups wrapper)
    if (Array.isArray(obj.pages)) {
      return {
        tabs: [{ tab: '', groups: [{ group: '', pages: obj.pages as ConfigNavPageEntry[] }] }],
        anchors: allAnchors,
      }
    }

    return { tabs: [], anchors: allAnchors }
  }

  return { tabs: [], anchors: [] }
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
): HolocronConfig['navigation'] {
  const tabs: ConfigNavTab[] = []
  const anchors: ConfigAnchor[] = [...existingAnchors]

  for (const raw of rawTabs) {
    const name = (raw.tab as string) || ''
    const icon = raw.icon as ConfigIcon | undefined
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
    const icon = link.icon as ConfigIcon | undefined
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
    return { socials: {} }
  }
  const obj = raw as Record<string, unknown>
  const socials = (obj.socials ?? {}) as Record<string, string>
  return { socials }
}
