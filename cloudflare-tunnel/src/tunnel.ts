import type {
  Request as CFRequest,
  ExecutionContext,
  DurableObjectNamespace,
  DurableObjectState,
  DurableObjectStub,
} from '@cloudflare/workers-types'

type Env = {
  TUNNEL_DO: DurableObjectNamespace
}

type Attachment = {
  role: 'up' | 'down'
}

export default {
  async fetch(req: CFRequest, env: Env, ctx?: ExecutionContext): Promise<Response> {
    // Answer CORS pre-flights (OPTIONS) immediately
    if (req.method === 'OPTIONS') return addCors(new Response(null, { status: 204 }))

    const url = new URL(req.url)

    // Intercept only the tunnel path
    if (url.pathname.startsWith('/_tunnel/')) {
      url.pathname = url.pathname.replace('/_tunnel', '')
      const id = env.TUNNEL_DO.idFromName(url.searchParams.get('id') ?? 'default')
      const res = await env.TUNNEL_DO.get(id).fetch(new Request(url.toString(), req))
      return addCors(res)
    }

    return await fetch(req)
  },
}

/* ------------ Durable Object ------------ */
export class Tunnel {
  ctx: DurableObjectState
  env: Env

  constructor(state: DurableObjectState, env: Env) {
    this.ctx = state
    this.env = env

    // Auto-respond to ping messages without waking the DO or forwarding to other clients
    // This saves costs and prevents unnecessary ping flooding through the tunnel

    // 1. Standard WebSocket ping/pong frames
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))

    // 2. JSON-formatted ping messages (common in applications)
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('{"type":"ping"}', '{"type":"pong"}')
    )

    // 2. Custom heartbeat messages (if your app uses them)
    // this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(
    //   JSON.stringify({ type: 'heartbeat' }),
    //   JSON.stringify({ type: 'heartbeat-ack' })
    // ))
  }

  async fetch(req: Request) {
    if (req.headers.get('Upgrade') !== 'websocket') return addCors(new Response('Upgrade required', { status: 400 }))

    const url = new URL(req.url)
    const role = url.pathname.startsWith('/upstream') ? 'up' : 'down'
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    if (role === 'up') {
      // Check if upstream already exists using live sockets
      const existingUp = this.getUpstream()
      if (existingUp?.readyState === WebSocket.OPEN) {
        // Accept the connection but immediately close it with a specific code
        server.accept()
        server.close(4009, 'Upstream already connected')
        // Still return a successful WebSocket upgrade response
        return addCors(new Response(null, { status: 101, webSocket: client }))
      }
      // Accept with hibernation and tag as upstream
      this.ctx.acceptWebSocket(server)
      server.serializeAttachment({ role: 'up' } satisfies Attachment)
    } else {
      // Check if upstream exists before accepting downstream
      const existingUp = this.getUpstream()
      if (!existingUp) {
        // Accept the WebSocket connection
        server.accept()
        // Immediately close it
        server.close(4008, 'No upstream available')
        // Return successful WebSocket upgrade response
        // The client will receive the close event after connection
        return addCors(new Response(null, { status: 101, webSocket: client }))
      }
      // Accept with hibernation and tag as downstream
      this.ctx.acceptWebSocket(server)
      server.serializeAttachment({ role: 'down' } satisfies Attachment)
    }

    return addCors(new Response(null, { status: 101, webSocket: client }))
  }

  /* ------ WebSocket event handlers for hibernation ------ */

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const attachment = ws.deserializeAttachment() as Attachment | undefined

    if (attachment?.role === 'up') {
      // Fan-out message from upstream to all downstreams
      const downs = this.getDownstreams()
      for (const down of downs) {
        try {
          down.send(message)
        } catch { }
      }
    } else if (attachment?.role === 'down') {
      // Forward message from downstream to upstream
      const up = this.getUpstream()
      if (up) {
        try {
          up.send(message)
        } catch { }
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const attachment = ws.deserializeAttachment() as Attachment | undefined

    if (attachment?.role === 'up') {
      // Upstream closed, close all downstreams
      const downs = this.getDownstreams()
      for (const down of downs) {
        try {
          down.close(1012, 'upstream closed')
        } catch { }
      }
    }
    // If downstream closes, it's automatically removed from the live set
  }

  async webSocketError(ws: WebSocket, error: any) {
    // Handle the same as close
    const attachment = ws.deserializeAttachment() as Attachment | undefined

    if (attachment?.role === 'up') {
      // Upstream errored, close all downstreams
      const downs = this.getDownstreams()
      for (const down of downs) {
        try {
          down.close(1011, 'upstream error')
        } catch { }
      }
    }
  }

  /* ------ Helper methods to get live sockets ------ */

  private getUpstream(): WebSocket | null {
    const sockets = this.ctx.getWebSockets()
    for (const ws of sockets) {
      const attachment = ws.deserializeAttachment() as Attachment | undefined
      if (attachment?.role === 'up') {
        return ws
      }
    }
    return null
  }

  private getDownstreams(): WebSocket[] {
    const sockets = this.ctx.getWebSockets()
    const downs: WebSocket[] = []
    for (const ws of sockets) {
      const attachment = ws.deserializeAttachment() as Attachment | undefined
      if (attachment?.role === 'down') {
        downs.push(ws)
      }
    }
    return downs
  }
}

const addCors = (r: Response) => {
  // Clone the response, merging headers so we don't try to mutate immutable headers
  const newHeaders = new Headers(r.headers)
  newHeaders.set('Access-Control-Allow-Origin', '*')
  newHeaders.set('Access-Control-Allow-Headers', '*')
  newHeaders.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  return new Response(r.body, {
    status: r.status,
    statusText: r.statusText,
    headers: newHeaders,
    webSocket: (r as any).webSocket, // for 101 upgrade case; safe cast for Do-workers
  })
}
