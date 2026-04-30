// Smoke test for the deployed preview Holocron AI chat endpoint.
// Runs only when HOLOCRON_TEST_PREVIEW_AI_CHAT=1 is set because it calls a real external AI service.

const enabled = process.env.HOLOCRON_TEST_PREVIEW_AI_CHAT === '1'
const endpoint = process.env.HOLOCRON_PREVIEW_AI_CHAT_URL ?? 'https://preview.holocron.so/api/ai/v1/chat/completions'

if (!enabled) {
  console.log('Skipping preview AI chat smoke test. Set HOLOCRON_TEST_PREVIEW_AI_CHAT=1 to run it.')
  process.exit(0)
}

console.log(`Testing preview AI chat endpoint: ${endpoint}`)

const response = await fetch(endpoint, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'llama-3.1-8b',
    messages: [
      { role: 'system', content: 'You are a weather assistant. Call the weather tool when asked for weather.' },
      { role: 'user', content: 'What is the weather in Rome? Use the tool.' },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'get_current_weather',
          description: 'Get the current weather for a city.',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'City and country, for example Rome, Italy.' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
            },
            required: ['location'],
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'get_current_weather' } },
    max_tokens: 200,
  }),
})

const text = await response.text()
let payload: { choices?: Array<{ message?: { tool_calls?: Array<object> } }> }
try {
  payload = JSON.parse(text)
} catch {
  console.log(text)
  throw new Error(`Preview AI chat returned non-JSON response: ${text}`)
}

console.log(JSON.stringify(payload, null, 2))

if (!response.ok) {
  throw new Error(`Preview AI chat returned HTTP ${response.status}: ${text}`)
}

const toolCalls = payload.choices?.[0]?.message?.tool_calls
if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
  throw new Error(`Preview AI chat returned an unexpected payload: ${text}`)
}

console.log('Preview AI chat tool-call smoke test passed.')
