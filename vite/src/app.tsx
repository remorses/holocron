/**
 * Runtime entry. Top-level await resolves providers once at module load.
 * Users either run this directly or mount it on their own Spiceflow tree
 * via `import { app as holocronApp } from '@holocron.so/vite/app'`.
 */

import { createHolocronApp, type HolocronApp } from './app-factory.tsx'
import { base, getConfig } from 'virtual:holocron-config'
import { getNavigationData } from 'virtual:holocron-navigation'
import { getMdxSlugs, getMdxSource, getPageIconRefs } from 'virtual:holocron-mdx'
import { getImportedMdxFiles, getModules, pagesDirPrefix } from 'virtual:holocron-modules'

export const app = await createHolocronApp({
  base,
  getConfig,
  getNavigationData,
  getMdxSlugs,
  getMdxSource,
  getPageIconRefs,
  getModules,
  getImportedMdxFiles,
  pagesDirPrefix,
})
export type App = HolocronApp
