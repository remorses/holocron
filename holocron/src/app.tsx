/**
 * Holocron Spiceflow app entry — server-rendered documentation site.
 *
 * This file is used as the spiceflow entry point. It imports config and
 * navigation from virtual modules (injected by the Vite plugin), and
 * page content from a virtual import.meta.glob module.
 *
 * The actual rendering logic lives in createHolocronApp() in app-factory.tsx
 * so it can be tested independently.
 */

import { config, navigation, pagesDirPrefix } from 'virtual:holocron-config'
import { pages } from 'virtual:holocron-pages'

import { createHolocronApp } from './app-factory.tsx'

export const app = createHolocronApp({ config, navigation, pageLoaders: pages, pagesDirPrefix })
export type App = typeof app
