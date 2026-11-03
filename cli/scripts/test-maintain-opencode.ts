// Validates a deployed Maintain OpenAI-compatible route with a real OpenCode session.
// Set HOLOCRON_TEST_MAINTAIN_OPENCODE=1. Uses holocron login / HOLOCRON_KEY.
// Optional: HOLOCRON_PROJECT when session auth has more than one project.

import { getDeployClient } from '../src/api-client.ts'
import { runOpencodeSession } from '../src/maintain.ts'

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

console.log('Running an OpenCode session against the Holocron OpenAI-compatible endpoint')
try {
  const result = await runOpencodeSession({
    directory: process.cwd(),
    log: (line) => console.log(line),
    model: { providerID: created.providerId, id: created.modelId },
    providers: {
      [created.providerId]: {
        package: '@opencode/ai/providers/openai-compatible',
        settings: { apiKey: created.apiKey, baseURL: created.baseUrl },
        models: { [created.modelId]: { name: created.modelId } },
      },
    },
    system: 'Answer without using tools.',
    prompt: 'Reply with exactly the word pong and nothing else.',
  })
  if (result instanceof Error) {
    console.error('OpenCode session failed', result.message)
    process.exitCode = 1
  } else if (!/pong/i.test(result.finalText)) {
    console.error(`Expected the model to say pong, got: ${result.finalText}`)
    process.exitCode = 1
  } else {
    console.log('Maintain OpenCode route check passed')
  }
} finally {
  await client.safeFetch('/api/v0/maintain/runs/:runId/complete', {
    method: 'POST',
    params: { runId: created.runId },
    body: { projectId: created.projectId },
  }).catch(() => {})
}
