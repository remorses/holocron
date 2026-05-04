// Uses ambient types from @cloudflare/workers-types (provided by wrangler or consumer's tsconfig).
// No explicit import to avoid version conflicts between library and consumer.

export type TunnelEnv = {
  TUNNEL_DO: DurableObjectNamespace
}

export type Attachment = {
  role: 'up' | 'down'
  ids: string[]
  multiplexed?: boolean
  subscribeAll?: boolean
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

export type MultiplexedConnectedMessage = {
  id: string
  event: 'upstream_connected'
}

export type MultiplexedDiscoveredMessage = {
  id: string
  event: 'upstream_discovered'
}

export type MultiplexedMessage =
  | MultiplexedDataMessage
  | MultiplexedClosedMessage
  | MultiplexedErrorMessage
  | MultiplexedConnectedMessage
  | MultiplexedDiscoveredMessage

/**
 * Route /_tunnel/* requests to the Tunnel Durable Object.
 * Use this in your worker's fetch handler to add tunnel support.
 *
 * The doNamespace parameter lets you pass any DurableObjectNamespace binding,
 * so consumers are not forced to use a specific env shape.
 */
export function handleTunnelFetch({
  req,
  doNamespace,
}: {
  req: Request
  doNamespace: DurableObjectNamespace
}): Promise<Response> | null {
  const url = new URL(req.url)

  if (!url.pathname.startsWith('/_tunnel/')) {
    return null
  }

  url.pathname = url.pathname.replace('/_tunnel', '')
  const ids = url.searchParams.getAll('id')
  const namespace = url.searchParams.get('namespace')

  if (ids.length > 1 && !namespace) {
    return Promise.resolve(addCors(new Response('namespace required for multiple ids', { status: 400 })))
  }

  const doName = namespace ?? ids[0] ?? 'default'
  const doId = doNamespace.idFromName(doName)
  return doNamespace.get(doId).fetch(new Request(url.toString(), req as any)).then(addCors)
}

export default {
  async fetch(req: Request, env: TunnelEnv, ctx?: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return addCors(new Response(null, { status: 204 }))

    const result = handleTunnelFetch({ req, doNamespace: env.TUNNEL_DO })
    if (result) return result

    return await fetch(req)
  },
}

/* ------------ Durable Object ------------ */
export class Tunnel<E = TunnelEnv> {
  ctx: DurableObjectState
  env: E

  constructor(state: DurableObjectState, env: E) {
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

      this.notifyWildcardSubscribers(id, 'upstream_connected')
    } else if (isMultiplexer && ids.length === 0) {
      this.ctx.acceptWebSocket(server, ['down:*'])
      server.serializeAttachment({
        role: 'down',
        ids: [],
        multiplexed: true,
        subscribeAll: true,
      } satisfies Attachment)

      const existingUpstreamIds = this.getAllUpstreamIds()
      for (const upstreamId of existingUpstreamIds) {
        try {
          server.send(
            JSON.stringify({ id: upstreamId, event: 'upstream_discovered' } satisfies MultiplexedDiscoveredMessage)
          )
        } catch {}
      }
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

      const initialMessage = url.searchParams.get('initialMessage')
      if (initialMessage) {
        for (const id of availableIds) {
          const ups = this.ctx.getWebSockets(`up:${id}`)
          for (const up of ups) {
            try {
              up.send(initialMessage)
            } catch {}
          }
        }
      }
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

      const wildcardDowns = this.ctx.getWebSockets('down:*')
      for (const down of wildcardDowns) {
        try {
          down.send(JSON.stringify({ id: upstreamId, data: message } satisfies MultiplexedDataMessage))
        } catch {}
      }
    } else if (attachment.role === 'down') {
      const shouldUnwrap = attachment.multiplexed || attachment.subscribeAll || attachment.ids.length > 1

      let targetId: string | undefined
      let payload: string | ArrayBuffer

      if (shouldUnwrap && typeof message === 'string') {
        try {
          const parsed = JSON.parse(message)
          if (parsed.id && (attachment.subscribeAll || attachment.ids.includes(parsed.id))) {
            targetId = parsed.id
            payload = typeof parsed.data === 'string' ? parsed.data : JSON.stringify(parsed.data)
          } else if (!attachment.subscribeAll) {
            targetId = attachment.ids[0]
            payload = message
          } else {
            return
          }
        } catch {
          if (!attachment.subscribeAll) {
            targetId = attachment.ids[0]
            payload = message
          } else {
            return
          }
        }
      } else {
        if (!attachment.subscribeAll) {
          targetId = attachment.ids[0]
          payload = message
        } else {
          return
        }
      }

      if (targetId) {
        const ups = this.ctx.getWebSockets(`up:${targetId}`)
        if (ups.length > 0) {
          try {
            ups[0].send(payload)
          } catch {}
        }
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

      this.notifyWildcardSubscribers(upstreamId, 'upstream_closed')
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

      this.notifyWildcardSubscribers(upstreamId, 'upstream_error', errorInfo)
    }
  }

  protected closeUpstreamsForId(id: string, { code, reason }: { code: number; reason: string }) {
    const ups = this.ctx.getWebSockets(`up:${id}`)
    for (const up of ups) {
      try {
        up.close(code, reason)
      } catch {}
    }
  }

  protected getAllUpstreamIds(): string[] {
    const allSockets = this.ctx.getWebSockets()
    const upstreamIds: string[] = []
    for (const ws of allSockets) {
      const attachment = ws.deserializeAttachment() as Attachment | undefined
      if (attachment?.role === 'up' && attachment.ids[0]) {
        upstreamIds.push(attachment.ids[0])
      }
    }
    return upstreamIds
  }

  protected notifyWildcardSubscribers(
    upstreamId: string,
    event: 'upstream_connected' | 'upstream_closed' | 'upstream_error',
    errorInfo?: { message?: string; name?: string }
  ) {
    const wildcardDowns = this.ctx.getWebSockets('down:*')
    for (const down of wildcardDowns) {
      try {
        if (event === 'upstream_error') {
          down.send(
            JSON.stringify({
              id: upstreamId,
              event: 'upstream_error',
              error: errorInfo,
            } satisfies MultiplexedErrorMessage)
          )
        } else if (event === 'upstream_closed') {
          down.send(JSON.stringify({ id: upstreamId, event: 'upstream_closed' } satisfies MultiplexedClosedMessage))
        } else {
          down.send(JSON.stringify({ id: upstreamId, event: 'upstream_connected' } satisfies MultiplexedConnectedMessage))
        }
      } catch {}
    }
  }
}

export const addCors = (r: Response) => {
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
