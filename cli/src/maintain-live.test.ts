// Live Holocron and Vercel key lifecycle test, skipped without paid credentials.

import { describe, expect, test } from 'vitest'

const apiUrl = process.env.HOLOCRON_MAINTAIN_TEST_URL
const apiKey = process.env.HOLOCRON_MAINTAIN_TEST_KEY

describe.skipIf(!apiUrl || !apiKey)('maintain model access', () => {
  test('creates and revokes short-lived model access', async () => {
    const createdResponse = await fetch(new URL('/api/v0/maintain/runs', apiUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: '{}',
    })
    expect(createdResponse.status).toBe(200)
    const created = await createdResponse.json() as {
      runId: string
      projectId: string
      gatewayApiKey: string
      gatewayKeyId: string
      providerId: string
      modelId: string
      expiresAt: number
    }

    expect({
      ...created,
      runId: '<run-id>',
      projectId: '<project-id>',
      gatewayApiKey: '<redacted>',
      gatewayKeyId: '<key-id>',
      expiresAt: '<timestamp>',
    }).toMatchInlineSnapshot(`
      {
        "expiresAt": "<timestamp>",
        "gatewayApiKey": "<redacted>",
        "gatewayKeyId": "<key-id>",
        "modelId": "deepseek/deepseek-v4-flash",
        "projectId": "<project-id>",
        "providerId": "vercel",
        "runId": "<run-id>",
      }
    `)

    const completedResponse = await fetch(new URL(`/api/v0/maintain/runs/${created.runId}/complete`, apiUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: created.projectId, keyId: created.gatewayKeyId, reportedCostUsd: 0 }),
    })
    expect(completedResponse.status).toBe(200)
    expect(await completedResponse.json()).toMatchInlineSnapshot(`
      {
        "completed": true,
        "costUsd": 0,
      }
    `)
  })
})
