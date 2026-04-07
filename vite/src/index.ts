/**
 * @holocron.so/vite — Vite plugin for building documentation websites
 * from MDX files with a mintlify-compatible config.
 */

export { holocron, type HolocronPluginOptions } from './vite-plugin.ts'
export type { HolocronConfig, ConfigAnchor, ConfigNavTab, ConfigNavGroup, ConfigNavPageEntry } from './config.ts'
export type { Navigation, NavTab, NavGroup, NavPage, NavPageEntry, NavHeading } from './navigation.ts'
export {
  getActiveTab,
  getActiveGroups,
  findPage,
  collectAllPages,
  buildPageIndex,
} from './navigation.ts'
export { TableOfContentsPanel } from './components/toc-panel.tsx'

/* ── Typed client router + loader data ───────────────────────────────── */

export type { HolocronApp, HolocronLoaderData } from './app-factory.tsx'
