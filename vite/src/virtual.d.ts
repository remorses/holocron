/** Virtual module declarations for holocron Vite plugin */

declare module 'virtual:holocron-config' {
  import type { HolocronConfig } from './config.ts'
  import type { Navigation } from './navigation.ts'
  export const config: HolocronConfig
  export const navigation: Navigation
}

declare module 'virtual:holocron-mdx' {
  /** Pre-processed MDX content keyed by page slug. Server-only — never
   *  sent to the client bundle. */
  const content: Record<string, string>
  export default content
}

declare module 'virtual:holocron-icons' {
  import type { IconAtlas } from './lib/resolve-icons.ts'
  /** Serialized icon atlas — keys are `library:name` (e.g. `lucide:github`),
   *  values are `{ body, width, height }`. Populated at Vite plugin init
   *  by walking the config+navigation and resolving via
   *  @iconify-json/lucide. Only referenced icons are included. */
  export const iconAtlas: IconAtlas
}
