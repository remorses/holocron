# WebSocket Tunnel for **holocron.so**

This tunnel lets a **single "up-stream" Node process** and **many "down-stream" browsers** talk to each other through Cloudflare Workers + Durable Objects.

```
Browser  ⇆  wss://holocron.so/_tunnel/client?id=chat
              │
              ▼ (Cloudflare zone)
           Worker ➜ Durable Object "chat" ➜ Worker
              ▲
              │
Node app ⇆ wss://holocron.so/_tunnel/upstream?id=chat
```

---

`/_tunnel/*` hits the Worker; every other path reaches your origin untouched.

---

## 2 · Up-stream (Node + TypeScript)

```ts
// upstream.ts    npm i ws
import WebSocket from 'ws'

const ws = new WebSocket('wss://holocron.so/_tunnel/upstream?id=chat')

ws.on('open', () => {
    console.log('⇈ connected')

    // emit an event every 5 s
    setInterval(() => {
        ws.send(JSON.stringify({ ts: Date.now(), msg: 'hello!' }))
    }, 5000)
})

ws.on('message', (data) => {
    console.log('⇊ from browser', data.toString())
})

// keep-alive
setInterval(() => ws.ping?.(), 20000)
```

---

## 3 · Down-stream (browser)

```html
<!-- client.html -->
<textarea id="log" rows="10" cols="70" readonly></textarea><br />
<input id="out" /><button id="send">send</button>

<script type="module">
    const ws = new WebSocket('wss://holocron.so/_tunnel/client?id=chat')

    const log = (t) => (logEl.value += t + '\n')
    const logEl = document.getElementById('log')

    ws.onopen = () => log('[open]')
    ws.onmessage = (e) => log('[from server] ' + e.data)

    send.onclick = () => {
        ws.send(out.value)
        log('[to server]   ' + out.value)
        out.value = ''
    }
</script>
```

Open the page anywhere on the Internet → it reaches the Node process.

---

## 4 · Message flow

| Direction          | What the Durable Object does                             |
| ------------------ | -------------------------------------------------------- |
| **Up-stream → DO** | Broadcasts the message to **every connected browser**.   |
| **Browser → DO**   | Forwards the message to the **single up-stream** socket. |

Send strings, JSON, or binary—the tunnel doesn't touch payloads.

---

## 5 · Multiplexing (subscribe to multiple IDs in one connection)

Use the `/multiplexer` endpoint to receive messages from multiple upstreams in a single WebSocket connection.

### Namespaces

By default, each `id` gets its own Durable Object. To share a DO across multiple IDs, use the `namespace` parameter:

```
/_tunnel/upstream?namespace=myapp&id=channel-1
/_tunnel/upstream?namespace=myapp&id=channel-2
/_tunnel/multiplexer?namespace=myapp&id=channel-1&id=channel-2
```

All connections with the same `namespace` share the same Durable Object.

### Message format

The `/multiplexer` endpoint wraps all messages in JSON:

```ts
type MultiplexedDataMessage = {
  id: string
  data: string
}
```

The `data` field contains the original message as a string. If the upstream sent a string, `data` is that string. If the upstream sent binary data, `data` is the binary converted to a string.

**Receiving messages:**
```ts
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  console.log(`Message from ${msg.id}:`, msg.data)
}
```

**Sending messages** (specify which upstream to target):
```ts
ws.send(JSON.stringify({ id: 'channel-1', data: 'hello' }))
```

### Event messages

When an upstream disconnects, multiplexer clients receive an event instead of being disconnected:

```ts
type MultiplexedClosedMessage = {
  id: string
  event: 'upstream_closed'
}

type MultiplexedErrorMessage = {
  id: string
  event: 'upstream_error'
  error?: { message?: string; name?: string }
}
```

**Example:**
```ts
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if ('event' in msg) {
    console.log(`Upstream ${msg.id} disconnected:`, msg.event)
  } else {
    console.log(`Data from ${msg.id}:`, msg.data)
  }
}
```

### Full example

```ts
// Subscribe to two channels in one connection
const ws = new WebSocket(
  'wss://holocron.so/_tunnel/multiplexer?namespace=myapp&id=channel-1&id=channel-2'
)

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  
  if (msg.event === 'upstream_closed') {
    console.log(`Channel ${msg.id} went offline`)
    return
  }
  
  console.log(`[${msg.id}]`, msg.data)
}

// Send to specific channel
ws.send(JSON.stringify({ id: 'channel-1', data: 'hello channel 1' }))
```

---
