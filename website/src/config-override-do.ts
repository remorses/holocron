// Per-session config override storage backed by Durable Object SQLite.
//
// One DO instance per customization session (created via newUniqueId()).
// Each config change stores a row keyed by SHA-256 hash of the JSON content.
// The cookie holds `<doId>:<hash>` so the reader must know both the DO ID
// (random, unguessable) and the correct hash (content-addressable) to
// retrieve an override. Wrong hash returns null.
//
// Overrides older than 30 days are pruned by a daily alarm.

import { DurableObject } from 'cloudflare:workers'

const PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000 // 1 day
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

async function sha256hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hashBuffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export class ConfigOverrideDO extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS overrides (
        hash TEXT PRIMARY KEY,
        config TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)
    // Schedule daily cleanup alarm if none is set
    this.ctx.storage.getAlarm().then((alarm) => {
      if (!alarm) {
        this.ctx.storage.setAlarm(Date.now() + PRUNE_INTERVAL_MS)
      }
    })
  }

  /** Store a config override. Returns the content hash. Idempotent:
   *  storing the same JSON content returns the same hash without
   *  creating a duplicate row. */
  async store(override: Record<string, unknown>): Promise<string> {
    const json = JSON.stringify(override)
    const hash = await sha256hex(json)
    this.ctx.storage.sql.exec(
      `INSERT OR REPLACE INTO overrides (hash, config, created_at) VALUES (?, ?, ?)`,
      hash,
      json,
      Date.now(),
    )
    return hash
  }

  /** Retrieve a config override by hash. Returns null if the hash
   *  doesn't exist (wrong hash = no data, prevents tampering). */
  async get(hash: string): Promise<Record<string, unknown> | null> {
    const row = this.ctx.storage.sql
      .exec(`SELECT config FROM overrides WHERE hash = ?`, hash)
      .toArray()[0]
    if (!row) return null
    return JSON.parse(row.config as string)
  }

  /** Daily alarm: prune overrides older than 30 days. */
  async alarm(): Promise<void> {
    const cutoff = Date.now() - MAX_AGE_MS
    this.ctx.storage.sql.exec(
      `DELETE FROM overrides WHERE created_at < ?`,
      cutoff,
    )
    // Reschedule
    this.ctx.storage.setAlarm(Date.now() + PRUNE_INTERVAL_MS)
  }
}
