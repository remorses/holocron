/**
 * Holocron Spiceflow app entry — server-rendered documentation site.
 *
 * The outer app is stable at module scope. It loads runtime providers on each
 * request, builds a request-scoped Holocron app, and delegates handling to it.
 */

import { createHolocronApp, type HolocronApp } from './app-factory.tsx'
import { base, getConfig } from 'virtual:holocron-config'
import { getNavigationData } from 'virtual:holocron-navigation'
import { getMdxSlugs, getMdxSource } from 'virtual:holocron-mdx'
import { getIconAtlas } from 'virtual:holocron-icons'

export const app = createHolocronApp({
  base,
  getConfig,
  getNavigationData,
  getMdxSlugs,
  getMdxSource,
  getIconAtlas,
})
export type App = HolocronApp
