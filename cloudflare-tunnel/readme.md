# WebSocket Tunnel for **fumabase.com**

This tunnel lets a **single “up-stream” Node process** and **many “down-stream” browsers** talk to each other through Cloudflare Workers + Durable Objects.

```
Browser  ⇆  wss://fumabase.com/_tunnel/client?id=chat
              │
              ▼ (Cloudflare zone)
           Worker ➜ Durable Object “chat” ➜ Worker
              ▲
              │
Node app ⇆ wss://fumabase.com/_tunnel/upstream?id=chat
```

---

`/_tunnel/*` hits the Worker; every other path reaches your origin untouched.

---

## 2 · Up-stream (Node + TypeScript)

```ts
// upstream.ts    npm i ws
import WebSocket from 'ws'

const ws = new WebSocket('wss://fumabase.com/_tunnel/upstream?id=chat')

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
    const ws = new WebSocket('wss://fumabase.com/_tunnel/client?id=chat')

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

Send strings, JSON, or binary—the tunnel doesn’t touch payloads.

---
