/** Virtual module declarations for holocron Vite plugin */

declare module 'virtual:holocron-config' {
  import type { HolocronConfig } from './config.ts'
  export const base: string
  export function getConfig(): Promise<HolocronConfig>
}

declare module 'virtual:holocron-navigation' {
  import type { Navigation, NavVersionItem, NavDropdownItem } from './navigation.ts'
  export function getNavigationData(): Promise<{
    navigation: Navigation
    switchers: { versions: NavVersionItem[]; dropdowns: NavDropdownItem[] }
  }>
}

declare module 'virtual:holocron-mdx' {
  import type { IconRef } from './lib/collect-icons.ts'
  /** Pre-processed MDX content exposed through async getters so custom
   *  virtual-module implementations can load content at request time. */
  export function getMdxSlugs(): Promise<string[]>
  export function getMdxSource(slug: string): Promise<string | undefined>
  export function getPageIconRefs(slug: string): Promise<IconRef[]>
}

declare module 'virtual:holocron-mdx-page/*' {
  const content: string
  export default content
}

declare module 'virtual:holocron-modules' {
  /** Lazy glob of all importable files (snippets, components, colocated pages).
   *  Keys are relative paths from the Vite root (e.g. './snippets/card.tsx').
   *  Values are lazy loaders — call `await loader()` to get the module exports. */
  export function getModules(): Record<string, () => Promise<Record<string, any>>>
  export function getImportedMdxFiles(): Record<string, { markdown: string; baseUrl: string }>
  /** Pages directory relative to root, with ./ prefix and trailing slash.
   *  E.g. './pages/' or './' when pagesDir is the project root. */
  export const pagesDirPrefix: string
}

declare module 'cloudflare:workers' {
  export const env: any
}
