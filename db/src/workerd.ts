// Cloudflare Workers entrypoint for the Holocron D1 schema.
// Uses drizzle-orm/sqlite-proxy instead of drizzle-orm/d1 because the D1
// driver has a bug where db.batch() with findFirst returning no results
// crashes in mapRelationalRow (drizzle-team/drizzle-orm#2721). The
// sqlite-proxy driver already has the empty-result guard.
//
// sqlite-proxy expects rows as positional arrays ([[val1, val2], ...]),
// not as objects ([{col: val1}, ...]). For non-batch queries we use D1's
// raw() which returns array-of-arrays. For batch queries (where D1 only
// returns objects), we convert with d1ToRawRows, same as drizzle's D1
// driver does internally.

import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import * as schema from './schema.ts'

export { schema }

// Convert D1 object rows to positional arrays for sqlite-proxy.
// Same logic as drizzle-orm's d1ToRawMapping.
function d1ToRawRows(results: Record<string, unknown>[]) {
  return results.map((row) => Object.keys(row).map((k) => row[k]))
}

export function getDb() {
  return drizzle(
    async (sql, params, method) => {
      const stmt = env.DB.prepare(sql).bind(...params)
      if (method === 'run') {
        await stmt.run()
        return { rows: [] as any[] }
      }
      // raw() returns array-of-arrays which sqlite-proxy expects
      const rows = await stmt.raw()
      // sqlite-proxy expects a falsy rows value for `get` no-row results.
      // Returning [] is truthy and produces `{ id: undefined }` in findFirst.
      // https://github.com/drizzle-team/drizzle-orm/issues/5461
      if (method === 'get') return { rows: rows[0] as any }
      return { rows: rows as any[] }
    },
    async (queries) => {
      // D1 batch() is atomic. It only returns object rows (no raw()),
      // so we convert to positional arrays for sqlite-proxy.
      const stmts = queries.map((q) => env.DB.prepare(q.sql).bind(...q.params))
      const results = await env.DB.batch(stmts)
      return results.map((r, i) => {
        const rows = d1ToRawRows(r.results as Record<string, unknown>[])
        if (queries[i]!.method === 'get') return { rows: rows[0] as any }
        return { rows: rows as any[] }
      })
    },
    { schema, relations: schema.relations },
  )
}
