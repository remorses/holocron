// Per-org AI chat usage counter backed by Durable Object SQLite.
//
// One DO instance per org (via idFromName(orgId)). Tracks every chat
// request with project, model, page slug, and token counts so we can
// enforce monthly limits and later build usage histograms.
//
// Two-phase flow:
//   1. reserveUsage() — atomically checks the monthly limit AND inserts
//      a placeholder row (tokens=0) in the same DO RPC. Because a single
//      DO processes RPCs sequentially, concurrent requests are queued and
//      each sees the rows inserted by prior callers. No race window.
//   2. updateUsageTokens() — fills in token counts after streaming. Called
//      via waitUntil so it survives after the response closes. If it fails,
//      the request is still counted (row exists from step 1) but tokens
//      stay at 0, which is acceptable.

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

  /** Atomically check the monthly limit and reserve a usage slot.
   *  Inserts a placeholder row (tokens=0) so concurrent callers see it
   *  in their count. Returns the row id for updateUsageTokens(). */
  async reserveUsage(args: {
    sinceMs: number
    limit: number
    projectId: string
    model: string
    pageSlug: string
  }): Promise<
    | { allowed: true; usageId: number; currentRequests: number }
    | { allowed: false; currentRequests: number }
  > {
    const countRow = this.ctx.storage.sql
      .exec(`SELECT COUNT(*) AS cnt FROM chat_usage WHERE created_at >= ?`, args.sinceMs)
      .one()
    const current = countRow.cnt as number

    if (current >= args.limit) {
      return { allowed: false, currentRequests: current }
    }

    const insertRow = this.ctx.storage.sql
      .exec(
        `INSERT INTO chat_usage (project_id, model, page_slug, created_at)
         VALUES (?, ?, ?, ?)
         RETURNING id`,
        args.projectId,
        args.model,
        args.pageSlug,
        Date.now(),
      )
      .one()

    return { allowed: true, usageId: insertRow.id as number, currentRequests: current + 1 }
  }

  /** Update token counts for a previously reserved usage row.
   *  Called via waitUntil after streaming completes. */
  async updateUsageTokens(args: {
    usageId: number
    inputTokens: number
    outputTokens: number
  }): Promise<void> {
    const total = args.inputTokens + args.outputTokens
    this.ctx.storage.sql.exec(
      `UPDATE chat_usage SET input_tokens = ?, output_tokens = ?, total_tokens = ? WHERE id = ?`,
      args.inputTokens,
      args.outputTokens,
      total,
      args.usageId,
    )
  }
}
