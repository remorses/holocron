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
