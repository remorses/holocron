/**
 * Git blob SHA-1 computation.
 *
 * Produces the same hash GitHub uses for blob objects:
 *   SHA-1("blob <byte_length>\0<content>")
 *
 * Used to content-address MDX files for cache invalidation.
 * If the SHA matches the cached value, the file hasn't changed
 * and we skip re-parsing.
 */

import crypto from 'node:crypto'

export function gitBlobSha(content: string): string {
  const buf = Buffer.from(content, 'utf-8')
  return crypto
    .createHash('sha1')
    .update(`blob ${buf.length}\0`)
    .update(buf)
    .digest('hex')
}
