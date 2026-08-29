/**
 * Runtime entry. Top-level await resolves providers once at module load.
 * Users either run this directly or mount it on their own Spiceflow tree
 * via `import { app as holocronApp } from '@holocron.so/vite/app'`.
 */

import { createHolocronApp, type HolocronApp } from './app-factory.tsx'
import { getHolocronDataContract } from './build-navigation-data.ts'
import { getConfig as dataEntry } from 'virtual:holocron-data'

const data = getHolocronDataContract<(typeof dataEntry)['holocronData']>(dataEntry)

export const app = await createHolocronApp({
  base: data.base,
  getConfig: data.getConfig,
  getNavigationData: data.getNavigationData,
  getMdxSlugs: data.getMdxSlugs,
  getMdxSource: data.getMdxSource,
  getPageIconRefs: data.getPageIconRefs,
  getIconAtlas: data.getIconAtlas,
  getModules: data.getModules,
  pagesDirPrefix: data.pagesDirPrefix,
  runtimeTabs: data.runtimeTabEntries,
})
export type App = HolocronApp
