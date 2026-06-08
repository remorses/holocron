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
export { parseConfigSource } from './config.ts'

/* ── MDX processing + icon collection (for multi-tenant pipelines) ─── */

export { processMdx, type ProcessedMdx } from './lib/mdx-processor.ts'
export { collectIconRefs, type IconRef } from './lib/collect-icons.ts'

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
export { buildNavigationData, generateHolocronData } from './build-navigation-data.ts'
export type { HolocronNavigationData, GenerateHolocronDataResult } from './build-navigation-data.ts'
export { TableOfContentsPanel } from './components/toc-panel.tsx'

/* ── Typed client router + loader data ───────────────────────────────── */

export type { HolocronApp, HolocronLoaderData } from './app-factory.tsx'
