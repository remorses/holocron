import { DurableObject } from 'cloudflare:workers'

export default {
    async fetch(req: Request, env: Env) {
        // URL (path+query) → durable-object name ⇒ same name = same instance
        const url = new URL(req.url)
        const id = env.DURABLE_FETCH.idFromName(url.pathname + url.search)
        return env.DURABLE_FETCH.get(id).fetch(req)
    },
}

interface Env {
    DURABLE_FETCH: DurableObjectNamespace
}

export class DurableFetch extends DurableObject {
    private seq = 0 // next chunk index
    private fetching = false // upstream started?
    private live = new Set<WritableStreamDefaultWriter>()

    constructor(private state: DurableObjectState) {
        super(state, {})

        // Recover position on restart
        this.state.blockConcurrencyWhile(async () => {
            this.seq = (await this.state.storage.get<number>('seq')) ?? 0
            this.fetching =
                (await this.state.storage.get<boolean>('open')) ?? false
        })
    }

    /* ------------------------------------------------------ */
    async fetch(req: Request): Promise<Response> {
        if (req.method !== 'GET')
            return new Response('Only GET supported', { status: 405 })

        // Kick off upstream once (in background)
        if (!this.fetching) {
            const host = req.headers.get('x-real-host')
            if (!host)
                return new Response('x-real-host header missing', {
                    status: 400,
                })

            this.fetching = true
            await this.state.storage.put('open', true) // persist flag
            const upstream = new URL(req.url)
            upstream.host = host
            this.state.waitUntil(this.pipeUpstream(upstream.toString(), req))
        }

        // Build a new readable stream for this client
        const { readable, writable } = new TransformStream()
        const writer = writable.getWriter()

        // 1️⃣ replay stored chunks
        const storedChunks = await this.state.storage.list<Uint8Array>({
            prefix: 'c:',
        })
        for (const [, value] of storedChunks) {
            writer.write(value)
        }

        // 2️⃣ if upstream still open, keep streaming live
        if (this.fetching) {
            this.live.add(writer)
            readable
                .pipeTo(new WritableStream()) // consume to detect close
                .catch(() => {})
                .finally(() => this.live.delete(writer))
        } else {
            writer.close()
        }

        return new Response(readable, {
            headers: { 'cache-control': 'no-store' },
        })
    }

    /* ------------------------------------------------------ */
    /** Background: fetch upstream once, store + fan-out */
    private async pipeUpstream(url: string, req: Request) {
        try {
            const res = await fetch(url, {
                method: req.method,
                headers: req.headers,
                body: req.body,
            })
            const reader = res.body!.getReader()

            while (true) {
                const { value, done } = await reader.read()
                if (done) break

                // Persist raw bytes
                await this.state.storage.put(
                    `c:${this.seq}`,
                    value as Uint8Array,
                )
                this.seq++
                await this.state.storage.put('seq', this.seq)

                // Broadcast
                for (const w of this.live) {
                    try {
                        w.write(value)
                    } catch {}
                }
            }
        } finally {
            // Mark closed, close everyone
            await this.state.storage.put('open', false)
            this.fetching = false
            for (const w of this.live) {
                try {
                    w.close()
                } catch {}
            }
            this.live.clear()
        }
    }
}
