// Per-org AI chat usage counter backed by Durable Object SQLite.
//
// One DO instance per org (via idFromName(orgId)). Tracks every chat
// request with project, model, page slug, and token counts so we can
// enforce monthly limits and later build usage histograms.
//
// Only two RPC methods are exposed — checkLimit (read-only) and
// recordUsage (append). Dashboard/breakdown queries will be added
// when the UI needs them; the schema + indexes already support them.

import { DurableObject } from 'cloudflare:workers'

export const NOTICE_USAGE_LIMIT_REACHED = {
  type: 'notice',
  code: 'HOLOCRON_USAGE_LIMIT_REACHED',
  title: 'Monthly usage limit reached',
  message: 'Your organization has used all free monthly AI chat requests. Upgrade your plan for higher limits.',
} as const

export class UsageCounter extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS chat_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        model TEXT NOT NULL,
        page_slug TEXT NOT NULL DEFAULT '',
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `)
    this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_usage_created
      ON chat_usage (created_at)
    `)
    this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_usage_project_created
      ON chat_usage (project_id, created_at)
    `)
    this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_chat_usage_page_created
      ON chat_usage (page_slug, created_at)
    `)
  }

  /** Read-only limit check. Returns current request count since the given
   *  timestamp and whether a new request is allowed. */
  async checkLimit(args: {
    sinceMs: number
    limit: number
  }): Promise<{ allowed: boolean; currentRequests: number }> {
    const row = this.ctx.storage.sql
      .exec(
        `SELECT COUNT(*) AS cnt FROM chat_usage WHERE created_at >= ?`,
        args.sinceMs,
      )
      .one()
    const current = row.cnt as number
    return { allowed: current < args.limit, currentRequests: current }
  }

  /** Record a completed chat request with token counts. */
  async recordUsage(args: {
    projectId: string
    model: string
    pageSlug: string
    inputTokens: number
    outputTokens: number
  }): Promise<void> {
    const total = args.inputTokens + args.outputTokens
    this.ctx.storage.sql.exec(
      `INSERT INTO chat_usage (project_id, model, page_slug, input_tokens, output_tokens, total_tokens, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args.projectId,
      args.model,
      args.pageSlug,
      args.inputTokens,
      args.outputTokens,
      total,
      Date.now(),
    )
  }
}
