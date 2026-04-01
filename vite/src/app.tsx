/**
 * Holocron Spiceflow app entry — server-rendered documentation site.
 *
 * Imports config + navigation (lightweight, client-safe) and MDX content
 * (server-only) from virtual modules.
 */

import { config, navigation } from 'virtual:holocron-config'
import mdxContent from 'virtual:holocron-mdx'

import { createHolocronApp } from './app-factory.tsx'

export const app = createHolocronApp({ config, navigation, mdxContent })
export type App = typeof app
