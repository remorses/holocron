# durablefetch

**Durable, resumable `fetch()` for browsers and Node.js – powered by Cloudflare Durable Objects.**
Send a long-running request (e.g. OpenAI streaming), close the tab, come back later, and pick up the stream exactly where you left off.

- `npm i durablefetch`
- **Zero-config** CDN endpoint: `https://durablefetch.fumabase.com`
- **Self-host** in minutes (Cloudflare Workers, free tier)

---

## Example

To see how durablefetch works you can try visiting this url in the browser in different tabs: https://durablefetch.fumabase.com/postman-echo.com/server-events/20?randomId=xxxx

## Why?

Typical HTTP streams die when the client disconnects.
`durablefetch` puts a Cloudflare Durable Object between you and the origin:

1. **First request** → DO starts the upstream fetch in `waitUntil()`.
2. Every chunk is **persisted** (`state.storage`) and fanned-out to all live clients.
3. If the browser drops, the DO keeps going.
4. **Later requests with the same URL** → stored chunks replayed, live stream continues.
5. Once the origin finishes, the DO marks the conversation complete; subsequent callers just get the full buffered response.

Persistence lasts until you delete it (no automatic TTL).

---

## Quick start (client SDK)

```ts
import { DurableFetchClient } from 'durablefetch'

const df = new DurableFetchClient() // defaults to durablefetch.fumabase.com

// 1. Start a streaming request
const res = await df.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        /* … */
    }),
})

const reader = res.body!.getReader()
for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    console.log(new TextDecoder().decode(value))
}

// 2. Ask whether the stream is still in progress (optional)
const status = await df.isInProgress(
    'https://api.openai.com/v1/chat/completions',
)
console.log(status) // { inProgress: true, activeConnections: 1, chunksStored: 42, completed: false }
```
