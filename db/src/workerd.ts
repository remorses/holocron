// Cloudflare Workers entrypoint for the Holocron D1 schema.
// Uses drizzle-orm/sqlite-proxy instead of drizzle-orm/d1 because the D1
// driver has a bug where db.batch() with findFirst returning no results
// crashes in mapRelationalRow (drizzle-team/drizzle-orm#2721). The
// sqlite-proxy driver already has the empty-result guard.

import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import * as schema from './schema.ts'

export { schema }

export function getDb() {
  return drizzle(
    async (sql, params, method) => {
      const stmt = env.DB.prepare(sql).bind(...params)
      if (method === 'run') {
        await stmt.run()
        return { rows: [] as any[] }
      }
      const { results } = await stmt.all()
      // sqlite-proxy expects a falsy rows value for `get` no-row results.
      // Returning [] is truthy and produces `{ id: undefined }` in findFirst.
      // https://github.com/drizzle-team/drizzle-orm/issues/5461
      if (method === 'get') return { rows: results[0] as any }
      return { rows: results as any[] }
    },
    async (queries) => {
      const stmts = queries.map((q) => env.DB.prepare(q.sql).bind(...q.params))
      const results = await env.DB.batch(stmts)
      return results.map((r, i) => {
        if (queries[i]!.method === 'get') return { rows: r.results[0] as any }
        return { rows: r.results as any[] }
      })
    },
    { schema, relations: schema.relations },
  )
}
