/**
 * Holocron package version used to invalidate on-disk build caches across releases.
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const PACKAGE_VERSION = (require('../../package.json') as { version: string }).version
