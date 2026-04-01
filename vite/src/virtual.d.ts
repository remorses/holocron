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
