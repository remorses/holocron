/**
 * Holocron package version used to invalidate on-disk build caches across releases.
 */

import packageJson from '../../package.json' with { type: 'json' }

export const PACKAGE_VERSION = packageJson.version
