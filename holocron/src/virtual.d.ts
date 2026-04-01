/** Virtual module declarations for holocron Vite plugin */

declare module 'virtual:holocron-config' {
  import type { HolocronConfig } from './config.ts'
  import type { Navigation } from './navigation.ts'
  export const config: HolocronConfig
  export const navigation: Navigation
  /** Resolved pages dir prefix for glob key matching (e.g. "/pages") */
  export const pagesDirPrefix: string
}

declare module 'virtual:holocron-pages' {
  /** Lazy loaders for MDX files, keyed by glob path (e.g. "/pages/index.mdx") */
  export const pages: Record<string, () => Promise<string>>
}
