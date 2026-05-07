/**
 * @holocron.so/vite — Vite plugin for building documentation websites
 * from MDX files with a mintlify-compatible config.
 */

export { holocron, type HolocronPluginOptions, type HolocronVirtualModules } from './vite-plugin.ts'

/* ── Config types (normalized output shape) ──────────────────────────── */

export type {
  HolocronConfig,
  ConfigAnchor,
  ConfigNavTab,
  ConfigNavGroup,
  ConfigNavPageEntry,
  ConfigIcon,
  ConfigNavbarLink,
  ConfigNavbarPrimary,
  ConfigVersionItem,
  ConfigDropdownItem,
  FooterLinkColumn,
  FooterLinkItem,
} from './config.ts'

/* ── Config schema + raw input type (for validation & multi-tenant) ── */

export { holocronConfigSchema } from './schema.ts'
export type { HolocronConfigRaw } from './schema.ts'
export { normalize as normalizeConfig } from './lib/normalize-config.ts'

/* ── Enriched navigation types ───────────────────────────────────────── */

export type {
  Navigation,
  NavTab,
  NavGroup,
  NavPage,
  NavPageEntry,
  NavHeading,
  NavVersionItem,
  NavDropdownItem,
} from './navigation.ts'
export {
  getActiveTab,
  getActiveGroups,
  findPage,
  collectAllPages,
  buildPageIndex,
} from './navigation.ts'
export { buildNavigationData } from './build-navigation-data.ts'
export type { HolocronNavigationData } from './build-navigation-data.ts'
export { TableOfContentsPanel } from './components/toc-panel.tsx'

/* ── Typed client router + loader data ───────────────────────────────── */

export type { HolocronApp, HolocronLoaderData } from './app-factory.tsx'
