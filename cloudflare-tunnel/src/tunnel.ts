import type {
    Request as CFRequest,
    ExecutionContext,
    DurableObjectNamespace,
    DurableObjectStub,
} from '@cloudflare/workers-types'

type TunnelEnv = {
    TUNNEL_DO: DurableObjectNamespace
}
export default {
    async fetch(
        req: CFRequest,
        env: TunnelEnv,
        ctx?: ExecutionContext,
    ): Promise<Response> {
        // Answer CORS pre-flights (OPTIONS) immediately
        if (req.method === 'OPTIONS')
            return addCors(new Response(null, { status: 204 }))

        const url = new URL(req.url)

        // Intercept only the tunnel path
        if (url.pathname.startsWith('/_tunnel/')) {
            url.pathname = url.pathname.replace('/_tunnel', '')
            const id = env.TUNNEL_DO.idFromName(
                url.searchParams.get('id') ?? 'default',
            )
            const res = await env.TUNNEL_DO.get(id).fetch(
                new Request(url.toString(), req),
            )
            return addCors(res)
        }

        return await fetch(req)
    },
}

/* ------------ Durable Object ------------ */
export class Tunnel {
    constructor(state, env) {
        this.up = null // single Node process
        this.downs = new Set() // browsers
    }
    up: WebSocket | null
    downs: Set<WebSocket>
    // env: any

    async fetch(req) {
        if (req.headers.get('Upgrade') !== 'websocket')
            return addCors(new Response('Upgrade required', { status: 400 }))

        const url = new URL(req.url)
        const role = url.pathname.startsWith('/upstream') ? 'up' : 'down'
        const pair = new WebSocketPair()
        const [client, server] = Object.values(pair)

        if (role === 'up') {
            if (this.up)
                return addCors(new Response('Upstream exists', { status: 409 }))
            this.up = server
            server.accept()
            this.bindUp()
        } else {
            this.downs.add(server)
            server.accept()
            this.bindDown(server)
        }

        return addCors(new Response(null, { status: 101, webSocket: client }))
    }

    /* ------ wiring helpers ------ */

    bindUp() {
        const ws = this.up
        if (!ws) return

        ws.addEventListener('message', (ev) => {
            // Fan-out to every browser
            for (const c of this.downs) {
                try {
                    c.send(ev.data)
                } catch {}
            }
        })

        ws.addEventListener('close', () => {
            this.up = null
            for (const c of this.downs) c.close(1012, 'upstream closed')
            this.downs.clear()
        })
    }

    bindDown(ws) {
        ws.addEventListener('message', (ev) => {
            if (this.up) this.up.send(ev.data)
        })
        ws.addEventListener('close', () => this.downs.delete(ws))
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
