/**
 * Holocron Spiceflow app entry — server-rendered documentation site.
 *
 * Static site data (config, navigation, tabs, etc.) comes from `./data.ts`
 * which imports from `virtual:holocron-config`. MDX content and the app
 * factory live in `./app-factory.tsx` — this file just instantiates the
 * app and exposes the typed entrypoint.
 */

import { createHolocronApp, type HolocronApp } from './app-factory.tsx'

export const app = createHolocronApp()
export type App = HolocronApp
