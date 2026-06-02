// AI chat usage counter backed by Durable Object SQLite. One DO per org, but
// limits and counts are scoped PER PROJECT: rows store project_id + cost_usd
// (computed from token counts × the per-model rate table in lib/credits.ts).
// The monthly limit is a USD budget derived from the project's credits, so a
// free project is capped independently of its paid siblings.

import { DurableObject } from 'cloudflare:workers'

export const NOTICE_USAGE_LIMIT_REACHED = {
  type: 'notice',
  code: 'HOLOCRON_USAGE_LIMIT_REACHED',
  title: 'Monthly AI credits used up',
  message: 'This site has used all its monthly AI chat credits. Upgrade to Holocron Pro for higher limits.',
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
        cost_usd REAL NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `)
    // Additive migration: SQLite lacks "ADD COLUMN IF NOT EXISTS", so probe
    // first. Pre-existing rows default to 0 cost (they predate dollar tracking).
    const hasCostColumn = this.ctx.storage.sql
      .exec(`PRAGMA table_info(chat_usage)`)
      .toArray()
      .some((col) => col.name === 'cost_usd')
    if (!hasCostColumn) {
      this.ctx.storage.sql.exec(`ALTER TABLE chat_usage ADD COLUMN cost_usd REAL NOT NULL DEFAULT 0`)
    }
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

  /** Sum one project's USD spend since `sinceMs` and report whether it's under
   *  budget. Uses idx_chat_usage_project_created. */
  async checkLimit(args: {
    projectId: string
    sinceMs: number
    usdLimit: number
  }): Promise<{ allowed: boolean; usdUsed: number; usdLimit: number }> {
    const row = this.ctx.storage.sql
      .exec(
        `SELECT COALESCE(SUM(cost_usd), 0) AS used FROM chat_usage WHERE project_id = ? AND created_at >= ?`,
        args.projectId,
        args.sinceMs,
      )
      .one()
    const used = row.used as number
    return { allowed: used < args.usdLimit, usdUsed: used, usdLimit: args.usdLimit }
  }

  /** Record a completed chat request with token counts and the real USD cost. */
  async recordUsage(args: {
    projectId: string
    model: string
    pageSlug: string
    inputTokens: number
    outputTokens: number
    costUsd: number
  }): Promise<void> {
    const total = args.inputTokens + args.outputTokens
    this.ctx.storage.sql.exec(
      `INSERT INTO chat_usage (project_id, model, page_slug, input_tokens, output_tokens, total_tokens, cost_usd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args.projectId,
      args.model,
      args.pageSlug,
      args.inputTokens,
      args.outputTokens,
      total,
      args.costUsd,
      Date.now(),
    )
  }
}
