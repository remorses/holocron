// Tests for the per-project, dollar-based usage counter, running inside the
// Cloudflare Workers runtime against a real Durable Object (USAGE_COUNTER).
//
// The DO is keyed per org, but limits and counts are scoped per project: these
// verify that recordUsage sums cost_usd per project_id and that one project
// exhausting its budget never blocks a sibling project in the same org DO.
import { describe, test, expect } from 'vitest'
import { env } from 'cloudflare:workers'
import { ulid } from 'ulid'
import type { UsageCounter } from './usage-counter-do.ts'

function stubFor(orgId: string): DurableObjectStub<UsageCounter> {
  const id = env.USAGE_COUNTER.idFromName(orgId)
  return env.USAGE_COUNTER.get(id) as DurableObjectStub<UsageCounter>
}

const SINCE = 0 // count everything since epoch

describe('per-project dollar usage', () => {
  test('checkLimit sums cost only for the given project', async () => {
    const orgId = ulid()
    const projectA = ulid()
    const projectB = ulid()
    const stub = stubFor(orgId)

    await stub.recordUsage({ projectId: projectA, model: 'm', pageSlug: '', inputTokens: 100, outputTokens: 50, costUsd: 3 })
    await stub.recordUsage({ projectId: projectB, model: 'm', pageSlug: '', inputTokens: 100, outputTokens: 50, costUsd: 7 })

    const a = await stub.checkLimit({ projectId: projectA, sinceMs: SINCE, usdLimit: 5 })
    const b = await stub.checkLimit({ projectId: projectB, sinceMs: SINCE, usdLimit: 5 })

    expect(a.usdUsed).toBe(3)
    expect(b.usdUsed).toBe(7)
  })

  test("one project exhausting its budget does not block a sibling", async () => {
    const orgId = ulid()
    const broke = ulid()
    const fresh = ulid()
    const stub = stubFor(orgId)

    // `broke` spends past a $5 budget; `fresh` has spent nothing.
    await stub.recordUsage({ projectId: broke, model: 'm', pageSlug: '', inputTokens: 0, outputTokens: 0, costUsd: 6 })

    const brokeCheck = await stub.checkLimit({ projectId: broke, sinceMs: SINCE, usdLimit: 5 })
    const freshCheck = await stub.checkLimit({ projectId: fresh, sinceMs: SINCE, usdLimit: 5 })

    expect(brokeCheck.allowed).toBe(false)
    expect(freshCheck.allowed).toBe(true)
    expect(freshCheck.usdUsed).toBe(0)
  })

  test('checkLimit returns the limit it was given', async () => {
    const orgId = ulid()
    const projectId = ulid()
    const stub = stubFor(orgId)

    const check = await stub.checkLimit({ projectId, sinceMs: SINCE, usdLimit: 50 })
    expect(check).toMatchObject({ allowed: true, usdUsed: 0, usdLimit: 50 })
  })
})
