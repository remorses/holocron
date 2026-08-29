// Auth, subscription, and OpenAI-compatible Maintain routes.
// Upstream Vercel calls are mocked; billing uses the real UsageCounter DO.

import { describe, test, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:workers'
import { createSpiceflowFetch } from 'spiceflow/client'
import { app } from './server.tsx'
import { extractGenerationId, signMaintainRunToken } from './maintain-api.ts'
import { seedUserWithSession, seedOrg, seedProject, seedApiKey, seedSubscription, bearer } from './test/seed.ts'

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
    expect(created.models).toContain('glm-5.3-flash')
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
    expect(models.data.map((model) => model.id)).toEqual([
      'deepseek-v4-flash',
      'glm-5.3-flash',
    ])
  })

  test('reads the Vercel generation id from the first SSE chunk', async () => {
    const sse = [
      'data: {"id":"gen_01ARZ3NDEKTSV4RRFFQ69G5FAV","object":"chat.completion.chunk","choices":[{"index":0,"delta":{"content":"hi"}}]}',
      'data: [DONE]',
      '',
    ].join('\n')
    const id = await extractGenerationId(new Blob([sse]).stream(), true)
    expect(id).toBe('gen_01ARZ3NDEKTSV4RRFFQ69G5FAV')
  })
})
