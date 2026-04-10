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
  /** Pre-processed MDX content exposed through async getters so custom
   *  virtual-module implementations can load content at request time. */
  export function getMdxSlugs(): Promise<string[]>
  export function getMdxSource(slug: string): Promise<string | undefined>
}

declare module 'virtual:holocron-mdx-page/*' {
  const content: string
  export default content
}

declare module 'virtual:holocron-icons' {
  import type { IconAtlas } from './lib/resolve-icons.ts'
  /** Serialized icon atlas — keys are `library:name` (e.g. `lucide:github`),
   *  values are `{ body, width, height }`. Populated at Vite plugin init
   *  by walking the config+navigation and resolving via
   *  @iconify-json/lucide. Only referenced icons are included. */
  export function getIconAtlas(): Promise<IconAtlas>
}
