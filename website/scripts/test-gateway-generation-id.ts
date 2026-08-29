// Hits a real Vercel AI Gateway stream and checks extractGenerationId against it.

async function extractGenerationId(body: ReadableStream<Uint8Array> | null, stream: boolean) {
  if (!body) return null
  const text = await new Response(body).text()
  if (!stream) {
    try {
      const parsed = JSON.parse(text) as { id?: unknown }
      return typeof parsed.id === 'string' ? parsed.id : null
    } catch {
      return null
    }
  }
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const data = line.slice(6).trim()
    if (!data || data === '[DONE]') continue
    try {
      const chunk = JSON.parse(data) as { id?: unknown }
      if (typeof chunk.id === 'string') return chunk.id
    } catch {
      // incomplete SSE line
    }
  }
  return null
}

const apiKey = process.env.AI_GATEWAY_API_KEY ?? ''
if (!apiKey) {
  console.error('AI_GATEWAY_API_KEY is missing. Run with sigillo.')
  process.exit(1)
}

const url = 'https://ai-gateway.vercel.sh/v1/chat/completions'
const model = 'deepseek/deepseek-v4-flash'
const body = {
  model,
  stream: true,
  stream_options: { include_usage: true },
  messages: [{ role: 'user', content: 'Reply with exactly the word pong.' }],
}

console.log(`POST ${url}`)
console.log(`model=${model} stream=true`)
const response = await fetch(url, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify(body),
})
console.log(`status=${response.status} content-type=${response.headers.get('content-type')}`)
if (!response.ok || !response.body) {
  console.error(await response.text())
  process.exit(1)
}

const text = await response.text()
const events = text.split('\n').filter((line) => line.startsWith('data: ')).slice(0, 4)
console.log(`sse events=${text.split('\n').filter((line) => line.startsWith('data: ')).length}`)
for (const [i, event] of events.entries()) {
  console.log(`event[${i}]=${event.slice(0, 400)}`)
}

const id = await extractGenerationId(new Blob([text]).stream(), true)
console.log(`extractGenerationId=${id ?? '<null>'}`)
if (!id) {
  console.error('extractGenerationId returned null on a live Gateway stream.')
  process.exit(1)
}

console.log(`GET https://ai-gateway.vercel.sh/v1/generation?id=${id}`)
let generation: unknown = null
for (let attempt = 1; attempt <= 6; attempt++) {
  const lookup = await fetch(`https://ai-gateway.vercel.sh/v1/generation?id=${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${apiKey}` },
  })
  const payload = await lookup.text()
  console.log(`lookup attempt=${attempt} status=${lookup.status}`)
  if (lookup.ok) {
    generation = JSON.parse(payload)
    break
  }
  console.log(`lookup body=${payload.slice(0, 300)}`)
  await new Promise((resolve) => setTimeout(resolve, 1000))
}
if (!generation) {
  console.error('Gateway generation lookup failed after retries.')
  process.exit(1)
}
console.log(`generation=${JSON.stringify(generation).slice(0, 800)}`)
console.log('extractGenerationId works on a live AI Gateway stream')
