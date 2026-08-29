// Validates a deployed Maintain OpenAI-compatible route with a real OpenCode session.
// Set HOLOCRON_TEST_MAINTAIN_OPENCODE=1. Uses holocron login / HOLOCRON_KEY.
// Optional: HOLOCRON_PROJECT when session auth has more than one project.

import { createOpencodeClient } from '@opencode-ai/sdk/v2/client'
import { createOpencodeServer } from '@opencode-ai/sdk/v2/server'
import { getDeployClient } from '../src/api-client.ts'

const enabled = process.env.HOLOCRON_TEST_MAINTAIN_OPENCODE === '1'
const projectId = process.env.HOLOCRON_PROJECT ?? ''

if (!enabled) {
  console.log('Skipping Maintain OpenCode check. Set HOLOCRON_TEST_MAINTAIN_OPENCODE=1 to run it.')
  process.exit(0)
}

console.log('Resolving Holocron auth')
const client = await getDeployClient()
console.log(`auth type=${client.auth.type}`)
console.log('POST /api/v0/maintain/runs')
const created = await client.safeFetch('/api/v0/maintain/runs', {
  method: 'POST',
  body: projectId ? { projectId } : {},
})
if (created instanceof Error) {
  console.error(created.message)
  process.exit(1)
}
console.log(`runId=${created.runId}`)
console.log(`baseUrl=${created.baseUrl}`)
console.log(`providerId=${created.providerId} modelId=${created.modelId}`)
if (!created.apiKey.startsWith('mnt_')) {
  console.error('Run token is not an mnt_ maintain token. Refusing to start OpenCode.')
  process.exit(1)
}

console.log('Starting OpenCode against the Holocron OpenAI-compatible endpoint')
const server = await createOpencodeServer({
  hostname: '127.0.0.1',
  port: 0,
  timeout: 30_000,
  config: {
    provider: {
      [created.providerId]: {
        npm: '@ai-sdk/openai-compatible',
        options: { apiKey: created.apiKey, baseURL: created.baseUrl },
        models: { [created.modelId]: { name: created.modelId } },
      },
    },
  },
})
try {
  const oc = createOpencodeClient({ baseUrl: server.url })
  console.log(`OpenCode listening on ${server.url}`)
  const session = await oc.session.create({
    title: 'Maintain OpenCode route check',
    model: { id: created.modelId, providerID: created.providerId },
  })
  if (session.error || !session.data) {
    console.error('OpenCode could not create a session', session.error)
    process.exit(1)
  }
  console.log(`session=${session.data.id}`)
  const result = await oc.session.prompt({
    sessionID: session.data.id,
    model: { providerID: created.providerId, modelID: created.modelId },
    agent: 'build',
    tools: { bash: false, websearch: false, edit: false, write: false },
    parts: [{ type: 'text', text: 'Reply with exactly the word pong and nothing else.' }],
  })
  if (result.error || !result.data) {
    console.error('OpenCode prompt failed', result.error)
    process.exit(1)
  }
  const raw = JSON.stringify(result.data)
  console.log(`OpenCode result: ${raw.slice(0, 2000)}`)
  if (!/pong/i.test(raw)) {
    console.error('Expected the model to say pong.')
    process.exit(1)
  }
  console.log('Maintain OpenCode route check passed')
} finally {
  server.close()
  await client.safeFetch('/api/v0/maintain/runs/:runId/complete', {
    method: 'POST',
    params: { runId: created.runId },
    body: { projectId: created.projectId },
  }).catch(() => {})
}
