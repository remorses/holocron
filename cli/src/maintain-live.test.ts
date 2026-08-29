// Live Holocron Maintain access test, skipped without paid credentials.

import { describe, expect, test } from 'vitest'

const apiUrl = process.env.HOLOCRON_MAINTAIN_TEST_URL
const apiKey = process.env.HOLOCRON_MAINTAIN_TEST_KEY

describe.skipIf(!apiUrl || !apiKey)('maintain model access', () => {
  test('creates an OpenAI-compatible run token', async () => {
    const createdResponse = await fetch(new URL('/api/v0/maintain/runs', apiUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: '{}',
    })
    expect(createdResponse.status).toBe(200)
    const created = await createdResponse.json() as {
      runId: string
      projectId: string
      baseUrl: string
      apiKey: string
      providerId: string
      modelId: string
      models: string[]
      expiresAt: number
    }

    expect(created.apiKey.startsWith('mnt_')).toBe(true)
    expect({
      ...created,
      runId: '<run-id>',
      projectId: '<project-id>',
      apiKey: '<redacted>',
      expiresAt: '<timestamp>',
      baseUrl: created.baseUrl.replace(/https?:\/\/[^/]+/, 'https://host'),
      models: created.models,
    }).toMatchInlineSnapshot(`
      {
        "apiKey": "<redacted>",
        "baseUrl": "https://host/api/v0/maintain/v1",
        "expiresAt": "<timestamp>",
        "modelId": "deepseek-v4-flash",
        "models": [
          "deepseek-v4-flash",
          "glm-5.3-flash",
        ],
        "projectId": "<project-id>",
        "providerId": "holocron",
        "runId": "<run-id>",
      }
    `)

    const completedResponse = await fetch(new URL(`/api/v0/maintain/runs/${created.runId}/complete`, apiUrl), {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ projectId: created.projectId }),
    })
    expect(completedResponse.status).toBe(200)
    expect(await completedResponse.json()).toMatchInlineSnapshot(`
      {
        "completed": true,
      }
    `)
  })
})
