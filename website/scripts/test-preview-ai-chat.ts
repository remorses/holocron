// Smoke test for the deployed preview Holocron AI chat endpoint.
// Runs only when HOLOCRON_TEST_PREVIEW_AI_CHAT=1 is set because it calls a real external AI service.

const enabled = process.env.HOLOCRON_TEST_PREVIEW_AI_CHAT === '1'
import type { ModelMessage } from 'ai'
import type { HolocronChatChunk } from '../src/gateway.ts'
import { createSpiceflowFetch } from 'spiceflow/client'

const endpoint = new URL(process.env.HOLOCRON_PREVIEW_AI_CHAT_URL ?? 'https://preview.holocron.so/api/holocron/chat')
const docsZipUrl = process.env.HOLOCRON_PREVIEW_DOCS_ZIP_URL ?? 'https://preview.holocron.so/docs.zip'
const prompt = process.env.HOLOCRON_PREVIEW_AI_CHAT_PROMPT ?? 'Use the bash tool to run `cat /docs/index.mdx`, then answer with the first heading.'
const resumePrompt = process.env.HOLOCRON_PREVIEW_AI_CHAT_RESUME_PROMPT ?? 'Using the previous tool result, answer briefly: what file did you read?'
const apiKey = process.env.HOLOCRON_KEY ?? ''

if (!enabled) {
  console.log('Skipping preview AI chat smoke test. Set HOLOCRON_TEST_PREVIEW_AI_CHAT=1 to run it.')
  process.exit(0)
}

console.log(`Testing preview AI chat endpoint: ${endpoint.toString()}`)
console.log(`Prompt: ${prompt}`)
console.log(`Resume prompt: ${resumePrompt}`)
console.log(`Auth: ${apiKey ? 'HOLOCRON_KEY set' : 'no HOLOCRON_KEY, using temporary model'}`)

const safeFetch = createSpiceflowFetch(endpoint.origin, {
  headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
})

async function runChatTurn(label: string, messages: ModelMessage[]) {
  console.log(`\nRunning ${label} turn with ${messages.length} model messages.`)
  const stream = await safeFetch(endpoint.pathname, {
    method: 'POST',
    body: {
      messages,
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
  const toolOutputs: unknown[] = []
  let responseMessages: ModelMessage[] | undefined
  for await (const chunk of stream as AsyncIterable<HolocronChatChunk>) {
    chunks.push(chunk)
    console.log(JSON.stringify(chunk))

    if (chunk.type === 'text-delta') text += chunk.delta
    if (chunk.type === 'tool-input-available') toolCalls += 1
    if (chunk.type === 'tool-output-available') {
      toolResults += 1
      toolOutputs.push(chunk.output)
    }
    if (chunk.type === 'model-messages') responseMessages = chunk.messages
  }

  console.log(`\n${label} chunks:`)
  console.log(JSON.stringify(chunks, null, 2))
  console.log(`\n${label} summary:`)
  console.log(JSON.stringify({ text, toolCalls, toolResults, responseMessages: responseMessages?.length ?? 0 }, null, 2))
  if (!text.trim()) {
    throw new Error(`${label} turn returned no text chunks`)
  }
  if (!responseMessages?.length) {
    throw new Error(`${label} turn did not return model-messages for resumption`)
  }

  const messagesJson = JSON.stringify(responseMessages)

  return {
    text,
    toolCalls,
    toolResults,
    toolOutputs,
    responseMessages: JSON.parse(messagesJson) as ModelMessage[],
  }
}

const initialMessages: ModelMessage[] = [
  { role: 'system', content: 'You are testing Holocron docs chat. Use tools when the user asks for a command.' },
  { role: 'user', content: prompt },
]

const first = await runChatTurn('initial', initialMessages)
if (first.toolCalls === 0 || first.toolResults === 0) {
  throw new Error('Initial preview AI chat turn did not call and complete the bash tool')
}
if (!JSON.stringify(first.toolOutputs).includes('Holocron')) {
  throw new Error('Initial preview AI chat tool output did not include expected docs content')
}

const resumedMessages: ModelMessage[] = [
  ...initialMessages,
  ...first.responseMessages,
  { role: 'user', content: resumePrompt },
]

const resumed = await runChatTurn('resumed', resumedMessages)
if (!resumed.text.trim()) {
  throw new Error('Resumed turn returned empty text')
}

console.log('Preview AI chat smoke test passed.')
