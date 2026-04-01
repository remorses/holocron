/** Virtual module declarations for holocron Vite plugin */

declare module 'virtual:holocron-config' {
  import type { HolocronConfig } from './config.ts'
  import type { Navigation } from './navigation.ts'
  export const config: HolocronConfig
  export const navigation: Navigation
}
