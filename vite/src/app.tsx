/**
 * Holocron Spiceflow app entry — server-rendered documentation site.
 *
 * Imports config and navigation from virtual modules. The navigation tree
 * contains pre-processed MDX (paths rewritten, image dimensions injected)
 * so rendering is zero-I/O.
 */

import { config, navigation } from 'virtual:holocron-config'

import { createHolocronApp } from './app-factory.tsx'

export const app = createHolocronApp({ config, navigation })
export type App = typeof app
