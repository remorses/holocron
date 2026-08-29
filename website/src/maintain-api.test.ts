// Auth, subscription, and OpenAI-compatible Maintain routes.
// Upstream Vercel calls are mocked; billing uses the real UsageCounter DO.

import { describe, test, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { createSpiceflowFetch } from 'spiceflow/client'
import { app } from './server.tsx'
import { billedMaintainUsage, extractChatUsage, signMaintainRunToken } from './maintain-api.ts'
import { MAINTAIN_MODELS } from './lib/ai-models.ts'
import { seedUserWithSession, seedOrg, seedProject, seedApiKey, seedSubscription, bearer } from './test/seed.ts'

// Live Vercel AI Gateway SSE (2026-08-29). Last event carries usage + cost.
const GATEWAY_SSE_FIXTURE = [
  'data: {"id":"gen_01M16TNMCRG38G3SY7HYWJKXS5","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"pong"}}]}',
  '',
  'data: {"id":"gen_01M16TNMCRG38G3SY7HYWJKXS5","object":"chat.completion.chunk","choices":[{"index":0,"delta":{},"finish_reason":"length"}],"usage":{"prompt_tokens":12,"completion_tokens":16,"total_tokens":28,"cost":0.00000616,"is_byok":false,"prompt_tokens_details":{"cached_tokens":0,"audio_tokens":0,"video_tokens":0},"cost_details":{"upstream_inference_cost":null,"upstream_inference_prompt_cost":0,"upstream_inference_completions_cost":0},"completion_tokens_details":{"reasoning_tokens":16,"image_tokens":0},"cache_creation_input_tokens":0,"market_cost":0.00000616,"gateway_cost":0.00000616}}',
  '',
  'data: [DONE]',
  '',
].join('\n')

const f = createSpiceflowFetch(app)

function expectError(result: unknown, status: number): Error & { status: number } {
  expect(result).toBeInstanceOf(Error)
  const err = result as Error & { status: number }
  expect(err.status).toBe(status)
  return err
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM api_key').run()
})

describe('POST /api/v0/maintain/runs', () => {
  test('unauthenticated → 401', async () => {
    expectError(await f('/api/v0/maintain/runs', { method: 'POST', body: {} }), 401)
  })

  test('free project → 402', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)
    const key = await seedApiKey(orgId, projectId)
    const err = expectError(await f('/api/v0/maintain/runs', {
      method: 'POST',
      body: {},
      headers: bearer(key.fullKey),
    }), 402)
    expect(err.message).toMatch(/free plan/i)
    const detail = (err as { value?: { command?: string; hint?: string; projectId?: string } }).value
    expect(detail?.projectId).toBe(projectId)
    expect(detail?.command).toContain(`subscribe --project ${projectId}`)
    expect(detail?.hint).toMatch(/Subscribe this project/i)
  })

  test('pro project returns a run token, not the gateway key', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)
    await seedSubscription(orgId, projectId)
    const key = await seedApiKey(orgId, projectId)
    const created = await f('/api/v0/maintain/runs', {
      method: 'POST',
      body: {},
      headers: bearer(key.fullKey),
    })
    if (created instanceof Error) throw created
    expect(created.projectId).toBe(projectId)
    expect(created.providerId).toBe('holocron')
    expect(created.modelId).toBe('deepseek-v4-flash')
    expect(created.models).toEqual(Object.keys(MAINTAIN_MODELS))
    expect(created.baseUrl).toMatch(/\/api\/v0\/maintain\/v1$/)
    expect(created.apiKey.startsWith('mnt_')).toBe(true)
    expect(created.apiKey).not.toBe(env.AI_GATEWAY_API_KEY)
  })
})

describe('OpenAI-compatible maintain routes', () => {
  test('chat completions without a token → 401', async () => {
    expectError(await f('/api/v0/maintain/v1/chat/completions', {
      method: 'POST',
      body: { model: 'deepseek-v4-flash', messages: [] },
    }), 401)
  })

  test('expired run token → 401', async () => {
    const token = await signMaintainRunToken({
      runId: 'aut_expired',
      projectId: 'prj_x',
      orgId: 'org_x',
      exp: Date.now() - 1000,
    })
    expectError(await f('/api/v0/maintain/v1/chat/completions', {
      method: 'POST',
      body: { model: 'deepseek-v4-flash', messages: [] },
      headers: bearer(token),
    }), 401)
  })

  test('lists models with a valid run token', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)
    await seedSubscription(orgId, projectId)
    const key = await seedApiKey(orgId, projectId)
    const created = await f('/api/v0/maintain/runs', {
      method: 'POST',
      body: {},
      headers: bearer(key.fullKey),
    })
    if (created instanceof Error) throw created
    const models = await f('/api/v0/maintain/v1/models', { headers: bearer(created.apiKey) })
    if (models instanceof Error) throw models
    expect(models.data.map((model) => model.id)).toEqual(Object.keys(MAINTAIN_MODELS))
  })

  test('unknown model → 400', async () => {
    const user = await seedUserWithSession()
    const orgId = await seedOrg(user.userId)
    const projectId = await seedProject(orgId)
    await seedSubscription(orgId, projectId)
    const key = await seedApiKey(orgId, projectId)
    const created = await f('/api/v0/maintain/runs', {
      method: 'POST',
      body: {},
      headers: bearer(key.fullKey),
    })
    if (created instanceof Error) throw created
    expectError(await f('/api/v0/maintain/v1/chat/completions', {
      method: 'POST',
      body: { model: 'anthropic/claude-sonnet-4', messages: [{ role: 'user', content: 'hi' }] },
      headers: bearer(created.apiKey),
    }), 400)
  })
})

describe('extractChatUsage', () => {
  test('reads usage and cost from a live Gateway SSE fixture', async () => {
    expect(await extractChatUsage(new Blob([GATEWAY_SSE_FIXTURE]).stream(), true)).toMatchInlineSnapshot(`
      {
        "cachedInputTokens": 0,
        "costUsd": 0.00000616,
        "inputTokens": 12,
        "outputTokens": 16,
      }
    `)
  })

  test('truncated stream estimates instead of $0', async () => {
    const truncated = 'data: {"id":"gen_x","choices":[{"delta":{"content":"hi"}}]}\ndata: {"usage":{"prompt_tokens":'
    const usage = await extractChatUsage(new Blob([truncated]).stream(), true)
    expect(usage).toBeNull()
    const billed = billedMaintainUsage({
      usage,
      model: 'deepseek-v4-flash',
      upstreamBody: { model: 'deepseek/deepseek-v4-flash', messages: [{ role: 'user', content: 'hi' }], max_tokens: 64 },
    })
    expect(billed.estimated).toBe(true)
    expect(billed.costUsd).toBeGreaterThan(0)
    expect(billed.outputTokens).toBe(64)
  })
})
