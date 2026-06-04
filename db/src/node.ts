// Node.js entrypoint for the Holocron D1 schema.
// Uses drizzle-orm/sqlite-proxy plus Cloudflare's D1 HTTP API so scripts can
// query the remote D1 database outside Cloudflare Workers through the same
// `db` package import path.

import { drizzle } from 'drizzle-orm/sqlite-proxy'
import * as schema from './schema.ts'

export { schema }

async function queryD1(sql: string, params: any[], method: string) {
  const endpoint = method === 'values' ? 'raw' : 'query'
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID!}/d1/database/${process.env.CLOUDFLARE_DATABASE_ID!}/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.CLOUDFLARE_D1_TOKEN!}`,
      },
      body: JSON.stringify({ sql, params }),
    },
  )

  const data = await response.json() as {
    success: boolean
    errors?: { code: number; message: string }[]
    result?: { results: any[] | { rows: any[] } }[]
  }

  if (!data.success) {
    throw new Error(data.errors?.map((e) => `${e.code}: ${e.message}`).join('\n') ?? 'Unknown D1 error')
  }

  const result = data.result?.[0]?.results
  const rows = Array.isArray(result) ? result : (result?.rows ?? [])

  // sqlite-proxy expects a falsy rows value for `get` no-row results.
  // Returning [] is truthy and produces `{ id: undefined }` in findFirst.
  // https://github.com/drizzle-team/drizzle-orm/issues/5461
  if (method === 'get') return { rows: rows[0] }
  return { rows }
}

export function getDb() {
  return drizzle(
    (sql, params, method) => queryD1(sql, params, method),
    async (queries) => Promise.all(queries.map((q) => queryD1(q.sql, q.params, q.method))),
    { schema, relations: schema.relations },
  )
}
