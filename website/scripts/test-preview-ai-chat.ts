// Smoke test for the deployed preview Holocron AI chat endpoint.
// Runs only when HOLOCRON_TEST_PREVIEW_AI_CHAT=1 is set because it calls a real external AI service.

const enabled = process.env.HOLOCRON_TEST_PREVIEW_AI_CHAT === '1'
import { createSpiceflowFetch } from 'spiceflow/client'

const endpoint = new URL(process.env.HOLOCRON_PREVIEW_AI_CHAT_URL ?? 'https://preview.holocron.so/api/holocron/chat')
const docsZipUrl = process.env.HOLOCRON_PREVIEW_DOCS_ZIP_URL ?? 'https://preview.holocron.so/docs.zip'

if (!enabled) {
  console.log('Skipping preview AI chat smoke test. Set HOLOCRON_TEST_PREVIEW_AI_CHAT=1 to run it.')
  process.exit(0)
}

console.log(`Testing preview AI chat endpoint: ${endpoint.toString()}`)

const safeFetch = createSpiceflowFetch(endpoint.origin)
const stream = await safeFetch(endpoint.pathname, {
  method: 'POST',
  body: {
    messages: [
      { role: 'system', content: 'You are testing Holocron docs chat. Answer with one short sentence.' },
      { role: 'user', content: 'Say hello from the preview AI chat smoke test.' },
    ],
    docsZipUrl,
    skillUrls: [],
  },
})

if (stream instanceof Error) {
  throw stream
}

const chunks: unknown[] = []
let text = ''
for await (const chunk of stream as AsyncIterable<{ type: string; delta?: string }>) {
  chunks.push(chunk)
  if (chunk.type === 'text-delta' && typeof chunk.delta === 'string') text += chunk.delta
}

console.log(JSON.stringify(chunks, null, 2))
if (!text.trim()) {
  throw new Error('Preview AI chat returned no text chunks')
}

console.log('Preview AI chat smoke test passed.')
