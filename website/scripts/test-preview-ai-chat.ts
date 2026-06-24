// Smoke test for the deployed preview Holocron AI chat endpoint.
// Runs only when HOLOCRON_TEST_PREVIEW_AI_CHAT=1 is set because it calls a real external AI service.

const enabled = process.env.HOLOCRON_TEST_PREVIEW_AI_CHAT === '1'
import type { HolocronChatChunk } from '../src/gateway.ts'
import { createSpiceflowFetch } from 'spiceflow/client'

const endpoint = new URL(process.env.HOLOCRON_PREVIEW_AI_CHAT_URL ?? 'https://preview.holocron.so/api/chat')
const docsZipUrl = process.env.HOLOCRON_PREVIEW_DOCS_ZIP_URL ?? 'https://preview.holocron.so/docs.zip'
const prompt = process.env.HOLOCRON_PREVIEW_AI_CHAT_PROMPT ?? 'Use the bash tool to run `cat /docs/index.mdx`, then answer with the first heading.'
const resumePrompt = process.env.HOLOCRON_PREVIEW_AI_CHAT_RESUME_PROMPT ?? 'Using the previous tool result, answer briefly: what file did you read?'
const apiKey = process.env.HOLOCRON_KEY ?? process.env.HOLOCRON_TOKEN ?? ''

if (!enabled) {
  console.log('Skipping preview AI chat smoke test. Set HOLOCRON_TEST_PREVIEW_AI_CHAT=1 to run it.')
  process.exit(0)
}

console.log(`Testing preview AI chat endpoint: ${endpoint.toString()}`)
console.log(`Prompt: ${prompt}`)
console.log(`Resume prompt: ${resumePrompt}`)
console.log(`Auth: ${apiKey ? 'API key set' : 'no HOLOCRON_KEY/HOLOCRON_TOKEN, using temporary model'}`)

const safeFetch = createSpiceflowFetch(endpoint.origin, {
  headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
})

const visitorId = crypto.randomUUID()

async function runChatTurn(label: string, message: string) {
  console.log(`\nRunning ${label} turn: "${message}"`)
  const stream = await safeFetch(endpoint.pathname, {
    method: 'POST',
    body: {
      message,
      visitorId,
      currentSlug: '/',
      docsZipUrl,
    },
  })

  if (stream instanceof Error) {
    throw stream
  }

  const chunks: HolocronChatChunk[] = []
  let text = ''
  let toolCalls = 0
  let toolResults = 0
  const toolOutputs: string[] = []
  let usage: { inputTokens: number; outputTokens: number; costUsd: number; credits: number } | undefined
  for await (const chunk of stream as AsyncIterable<HolocronChatChunk>) {
    chunks.push(chunk)
    console.log(JSON.stringify(chunk))

    if (chunk.type === 'text') text += chunk.text
    if (chunk.type === 'tool-call') toolCalls += 1
    if (chunk.type === 'tool-result') {
      toolResults += 1
      toolOutputs.push(chunk.output)
    }
    if (chunk.type === 'usage') {
      usage = { inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens, costUsd: chunk.costUsd, credits: chunk.credits }
    }
  }

  console.log(`\n${label} summary:`)
  console.log(JSON.stringify({ text: text.slice(0, 200), toolCalls, toolResults, usage }, null, 2))
  if (apiKey && !usage) {
    throw new Error(`${label} turn did not emit a usage chunk (credits/dollars tracking)`)
  }
  if (!text.trim()) {
    throw new Error(`${label} turn returned no text chunks`)
  }

  return { text, toolCalls, toolResults, toolOutputs }
}

const first = await runChatTurn('initial', prompt)
if (first.toolCalls === 0 || first.toolResults === 0) {
  throw new Error('Initial preview AI chat turn did not call and complete the bash tool')
}
if (!JSON.stringify(first.toolOutputs).includes('Holocron')) {
  throw new Error('Initial preview AI chat tool output did not include expected docs content')
}

// Second turn reuses the same visitorId so the Flue agent continues the session
const resumed = await runChatTurn('resumed', resumePrompt)
if (!resumed.text.trim()) {
  throw new Error('Resumed turn returned empty text')
}

console.log('Preview AI chat smoke test passed.')
