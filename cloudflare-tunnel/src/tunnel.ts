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
  ids: string[]
  multiplexed?: boolean
}

export type MultiplexedDataMessage = {
  id: string
  data: string | ArrayBuffer
}

export type MultiplexedClosedMessage = {
  id: string
  event: 'upstream_closed'
}

export type MultiplexedErrorMessage = {
  id: string
  event: 'upstream_error'
  error?: {
    message?: string
    name?: string
  }
}

export type MultiplexedMessage = MultiplexedDataMessage | MultiplexedClosedMessage | MultiplexedErrorMessage

export default {
  async fetch(req: CFRequest, env: Env, ctx?: ExecutionContext): Promise<Response> {
    // Answer CORS pre-flights (OPTIONS) immediately
    if (req.method === 'OPTIONS') return addCors(new Response(null, { status: 204 }))

    const url = new URL(req.url)

    // Intercept only the tunnel path
    if (url.pathname.startsWith('/_tunnel/')) {
      url.pathname = url.pathname.replace('/_tunnel', '')
      const ids = url.searchParams.getAll('id')
      const namespace = url.searchParams.get('namespace')

      if (ids.length > 1 && !namespace) {
        return addCors(new Response('namespace required for multiple ids', { status: 400 }))
      }

      const doName = namespace ?? ids[0] ?? 'default'
      const doId = env.TUNNEL_DO.idFromName(doName)
      const res = await env.TUNNEL_DO.get(doId).fetch(new Request(url.toString(), req))
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
    if (req.headers.get('Upgrade') !== 'websocket') {
      return addCors(new Response('Upgrade required', { status: 400 }))
    }

    const url = new URL(req.url)
    const isUpstream = url.pathname.startsWith('/upstream')
    const isMultiplexer = url.pathname.startsWith('/multiplexer')
    const ids = url.searchParams.getAll('id')
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair)

    if (isUpstream) {
      const id = ids[0]
      if (!id) {
        return addCors(new Response('id required', { status: 400 }))
      }

      this.closeUpstreamsForId(id, { code: 4009, reason: 'Upstream already connected' })
      this.ctx.acceptWebSocket(server, [`up:${id}`])
      server.serializeAttachment({ role: 'up', ids: [id] } satisfies Attachment)
    } else {
      if (ids.length === 0) {
        return addCors(new Response('id required', { status: 400 }))
      }

      const availableIds = ids.filter((id) => {
        return this.ctx.getWebSockets(`up:${id}`).length > 0
      })
      if (availableIds.length === 0) {
        server.accept()
        server.close(4008, 'No upstream available')
        return addCors(new Response(null, { status: 101, webSocket: client }))
      }

      const tags = ids.map((id) => {
        return `down:${id}`
      })
      this.ctx.acceptWebSocket(server, tags)
      server.serializeAttachment({
        role: 'down',
        ids,
        multiplexed: isMultiplexer,
      } satisfies Attachment)
    }

    return addCors(new Response(null, { status: 101, webSocket: client }))
  }

  /* ------ WebSocket event handlers for hibernation ------ */

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const attachment = ws.deserializeAttachment() as Attachment | undefined
    if (!attachment) {
      return
    }

    if (attachment.role === 'up') {
      const upstreamId = attachment.ids[0]
      const downs = this.ctx.getWebSockets(`down:${upstreamId}`)
      for (const down of downs) {
        try {
          const downAttachment = down.deserializeAttachment() as Attachment
          const shouldWrap = downAttachment.multiplexed || downAttachment.ids.length > 1
          const payload = shouldWrap
            ? JSON.stringify({ id: upstreamId, data: message } satisfies MultiplexedDataMessage)
            : message
          down.send(payload)
        } catch {}
      }
    } else if (attachment.role === 'down') {
      const shouldUnwrap = attachment.multiplexed || attachment.ids.length > 1

      let targetId: string
      let payload: string | ArrayBuffer

      if (shouldUnwrap && typeof message === 'string') {
        try {
          const parsed = JSON.parse(message)
          if (parsed.id && attachment.ids.includes(parsed.id)) {
            targetId = parsed.id
            payload = typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data)
          } else {
            targetId = attachment.ids[0]
            payload = message
          }
        } catch {
          targetId = attachment.ids[0]
          payload = message
        }
      } else {
        targetId = attachment.ids[0]
        payload = message
      }

      const ups = this.ctx.getWebSockets(`up:${targetId}`)
      if (ups.length > 0) {
        try {
          ups[0].send(payload)
        } catch {}
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    const attachment = ws.deserializeAttachment() as Attachment | undefined
    if (!attachment) {
      return
    }

    if (attachment.role === 'up') {
      const upstreamId = attachment.ids[0]
      const downs = this.ctx.getWebSockets(`down:${upstreamId}`)
      for (const down of downs) {
        try {
          const downAttachment = down.deserializeAttachment() as Attachment
          const shouldWrap = downAttachment.multiplexed || downAttachment.ids.length > 1
          if (shouldWrap) {
            down.send(
              JSON.stringify({ id: upstreamId, event: 'upstream_closed' } satisfies MultiplexedClosedMessage)
            )
          } else {
            down.close(1012, 'upstream closed')
          }
        } catch {}
      }
    }
  }

  async webSocketError(ws: WebSocket, error: unknown) {
    const attachment = ws.deserializeAttachment() as Attachment | undefined
    if (!attachment) {
      return
    }

    if (attachment.role === 'up') {
      const upstreamId = attachment.ids[0]
      const errorInfo = (() => {
        if (error instanceof Error) {
          return { message: error.message, name: error.name }
        }
        if (typeof error === 'string') {
          return { message: error }
        }
        return undefined
      })()

      const downs = this.ctx.getWebSockets(`down:${upstreamId}`)
      for (const down of downs) {
        try {
          const downAttachment = down.deserializeAttachment() as Attachment
          const shouldWrap = downAttachment.multiplexed || downAttachment.ids.length > 1
          if (shouldWrap) {
            down.send(
              JSON.stringify({
                id: upstreamId,
                event: 'upstream_error',
                error: errorInfo,
              } satisfies MultiplexedErrorMessage)
            )
          } else {
            down.close(1011, 'upstream error')
          }
        } catch {}
      }
    }
  }

  private closeUpstreamsForId(id: string, { code, reason }: { code: number; reason: string }) {
    const ups = this.ctx.getWebSockets(`up:${id}`)
    for (const up of ups) {
      try {
        up.close(code, reason)
      } catch {}
    }
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
