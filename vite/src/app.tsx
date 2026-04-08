/**
 * Holocron Spiceflow app entry — server-rendered documentation site.
 *
 * Canonical site data is loaded once on the server and passed into the app
 * factory so route setup can use the same object outside component render.
 */

import { createHolocronApp, type HolocronApp } from './app-factory.tsx'
import { config, navigation, switchers, base } from 'virtual:holocron-config'
import { iconAtlas } from 'virtual:holocron-icons'
import type { HolocronSiteData } from './site-data.ts'

const site: HolocronSiteData = {
  config,
  navigation,
  switchers,
  base,
  icons: iconAtlas,
}

export const app = createHolocronApp(site)
export type App = HolocronApp
