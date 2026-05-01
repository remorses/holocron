// Smoke test for the deployed preview Holocron AI chat endpoint.
// Runs only when HOLOCRON_TEST_PREVIEW_AI_CHAT=1 is set because it calls a real external AI service.

const enabled = process.env.HOLOCRON_TEST_PREVIEW_AI_CHAT === '1'
import type { HolocronChatChunk } from '../src/gateway.ts'
import { createSpiceflowFetch } from 'spiceflow/client'

const endpoint = new URL(process.env.HOLOCRON_PREVIEW_AI_CHAT_URL ?? 'https://preview.holocron.so/api/holocron/chat')
const docsZipUrl = process.env.HOLOCRON_PREVIEW_DOCS_ZIP_URL ?? 'https://preview.holocron.so/docs.zip'
const prompt = process.env.HOLOCRON_PREVIEW_AI_CHAT_PROMPT ?? 'Use the bash tool to run `pwd`, then answer with the command output.'
const apiKey = process.env.HOLOCRON_API_KEY ?? ''

if (!enabled) {
  console.log('Skipping preview AI chat smoke test. Set HOLOCRON_TEST_PREVIEW_AI_CHAT=1 to run it.')
  process.exit(0)
}

console.log(`Testing preview AI chat endpoint: ${endpoint.toString()}`)
console.log(`Prompt: ${prompt}`)
console.log(`Auth: ${apiKey ? 'HOLOCRON_API_KEY set' : 'no HOLOCRON_API_KEY, using temporary model'}`)

const safeFetch = createSpiceflowFetch(endpoint.origin, {
  headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
})
const stream = await safeFetch(endpoint.pathname, {
  method: 'POST',
  body: {
    messages: [
      { role: 'system', content: 'You are testing Holocron docs chat. Use tools when the user asks for a command.' },
      { role: 'user', content: prompt },
    ],
    docsZipUrl,
    skillUrls: [],
  },
})

if (stream instanceof Error) {
  throw stream
}

const chunks: HolocronChatChunk[] = []
let text = ''
let toolCalls = 0
let toolResults = 0
for await (const chunk of stream as AsyncIterable<HolocronChatChunk>) {
  chunks.push(chunk)
  console.log(JSON.stringify(chunk))

  if (chunk.type === 'text-delta') text += chunk.delta
  if (chunk.type === 'tool-input-available') toolCalls += 1
  if (chunk.type === 'tool-output-available') toolResults += 1
}

console.log('\nFull chunks:')
console.log(JSON.stringify(chunks, null, 2))
console.log('\nSummary:')
console.log(JSON.stringify({ text, toolCalls, toolResults }, null, 2))
if (!text.trim()) {
  throw new Error('Preview AI chat returned no text chunks')
}

console.log('Preview AI chat smoke test passed.')
