/**
 * Parser for OpenAPI endpoint references in navigation `pages` arrays.
 *
 * In "selective endpoints" mode (Mintlify-compatible), a tab/group with an
 * `openapi` spec can list page entries that mix normal MDX slugs with endpoint
 * references. An endpoint reference is a string matching `METHOD /path`, e.g.
 * `"GET /users"`. The optional `specfile METHOD /path` form (e.g.
 * `"v2.json POST /orders"`) targets a specific spec when multiple are provided.
 *
 * Anything that does not match the endpoint-ref grammar is treated as a normal
 * MDX slug and returned as `null`.
 */

import { HTTP_METHODS, type HttpMethod } from './process.ts'

export interface EndpointRef {
  /** Optional spec file the endpoint belongs to (multi-spec form). */
  specFile?: string
  method: HttpMethod
  path: string
}

const METHOD_ALTERNATION = HTTP_METHODS.join('|')

// "GET /users"  or  "v2.json GET /users"
// method is case-insensitive; path must start with "/".
const ENDPOINT_RE = new RegExp(
  `^(?:(?<specFile>\\S+)\\s+)?(?<method>${METHOD_ALTERNATION})\\s+(?<path>/\\S*)$`,
  'i',
)

/**
 * Parse a page entry string into an EndpointRef, or return null if the entry
 * is a normal MDX slug (not an endpoint reference).
 */
export function parseEndpointRef(entry: string): EndpointRef | null {
  const match = ENDPOINT_RE.exec(entry.trim())
  if (!match?.groups) return null

  const { specFile, method, path } = match.groups

  // Guard: a single-token slug like "api/get-users" must not match. The regex
  // already requires whitespace before the path, so this is defensive only.
  if (!method || !path) return null

  return {
    ...(specFile ? { specFile } : {}),
    method: method.toLowerCase() as HttpMethod,
    path,
  }
}

/** Lookup key for matching an endpoint ref against an extracted operation.
 *  OpenAPI path keys are literal, so the path is NOT normalized — `/users`
 *  and `/users/` are distinct operations and must not collapse. */
export function endpointKey(method: HttpMethod, path: string): string {
  return `${method.toLowerCase()} ${path}`
}
