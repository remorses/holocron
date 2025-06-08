import { DurableObject } from 'cloudflare:workers'

export default {
    async fetch(req: Request, env: Env) {
        const url = new URL(req.url)

        // Redirect root path to GitHub
        if (url.pathname === '/') {
            return Response.redirect(
                'https://github.com/remorses/durablefetch',
                302,
            )
        }

        if (url.pathname === '/durablefetch-example-stream-sse') {
            const n = parseInt(url.searchParams.get('n') || '10')

            const stream = new ReadableStream({
                start(controller) {
                    let count = 0
                    const interval = setInterval(() => {
                        if (count >= n) {
                            controller.enqueue(
                                new TextEncoder().encode('data: [DONE]\n\n'),
                            )
                            controller.close()
                            clearInterval(interval)
                            return
                        }

                        const data = `data: ${JSON.stringify({ number: count + 1 })}\n\n`
                        controller.enqueue(new TextEncoder().encode(data))
                        count++
                    }, 300)
                },
            })

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    Connection: 'keep-alive',
                },
            })
        }
        const { key, requestForDO } = await createDurableObjectRequest(url, req)
        const id = env.DURABLE_FETCH.idFromName(key)
        return env.DURABLE_FETCH.get(id).fetch(requestForDO)
    },
}

interface Env {
    DURABLE_FETCH: DurableObjectNamespace
}

export class DurableFetch extends DurableObject {
    private seq = 0 // next chunk index
    private fetching = false // upstream started?
    private completed = false // upstream finished successfully?
    private live = new Set<WritableStreamDefaultWriter>()
    private kvLock = Promise.resolve()

    constructor(private state: DurableObjectState) {
        super(state, {})

        // Recover position on restart
        this.state.blockConcurrencyWhile(async () => {
            this.seq = (await this.state.storage.get<number>('seq')) ?? 0
            this.fetching =
                (await this.state.storage.get<boolean>('open')) ?? false
            this.completed =
                (await this.state.storage.get<boolean>('completed')) ?? false
        })
    }

    /* ------------------------------------------------------ */
    async fetch(req: Request): Promise<Response> {
        const url = new URL(req.url)

        // Handle /in-progress POST requests
        if (url.pathname === '/in-progress' && req.method === 'POST') {
            return this.checkInProgress()
        }

        if (req.method !== 'GET')
            return new Response('Only GET supported', { status: 405 })

        // Kick off upstream once (in background) - only if not already completed
        if (!this.fetching && !this.completed) {
            this.fetching = true
            await this.state.storage.put('open', true) // persist flag
            const upstream = new URL(req.url)
            this.state.waitUntil(
                this.pipeUpstream(upstream.toString(), req.clone()),
            )
        }

        // Build a new readable stream for this client
        const { readable, writable } = new TransformStream()
        const writer = writable.getWriter()
        let resolve: Function
        this.kvLock = new Promise((r) => {
            resolve = r
        })
        // 1️⃣ replay stored chunks with storage lock
        await this.state
            .blockConcurrencyWhile(async () => {
                const storedChunks = await this.state.storage.list<Uint8Array>({
                    prefix: 'c:',
                })
                await Promise.all(
                    [...storedChunks].map(([, value]) => {
                        writer.write(value)
                    }),
                )
            })
            .finally(() => {
                resolve()
            })

        // 2️⃣ if upstream still open, keep streaming live
        if (this.fetching) {
            console.log(`already fetching ${req.url}, resuming stream`)
            this.live.add(writer)
        } else {
            writer.close()
        }

        // Fork the readable stream into two branches
        const [toClient, toDrain] = readable.tee()

        // Pipe the drain-branch to detect when client disconnects
        if (this.fetching) {
            toDrain
                .pipeTo(new WritableStream())
                .catch((e) => {
                    console.error(`readable stream error`, e)
                })
                .finally(() => this.live.delete(writer))
        }

        return new Response(toClient, {
            headers: { 'cache-control': 'no-store' },
        })
    }

    /* ------------------------------------------------------ */
    /** Check if there's an in-progress stream */
    private async checkInProgress(): Promise<Response> {
        const inProgress = this.fetching
        const activeConnections = this.live.size
        const chunksStored = this.seq

        return new Response(
            JSON.stringify({
                inProgress,
                activeConnections,
                chunksStored,
            }),
            {
                headers: { 'content-type': 'application/json' },
            },
        )
    }

    /* ------------------------------------------------------ */
    /** Background: fetch upstream once, store + fan-out */
    private async pipeUpstream(url: string, req: Request<any, any>) {
        try {
            const res = await fetch(url, {
                method: req.method,
                headers: req.headers,
                body:
                    req.method === 'GET' || req.method === 'HEAD'
                        ? undefined
                        : req.body,
            })
            const reader = res.body!.getReader()

            while (true) {
                const { value, done } = await reader.read()
                if (done) break

                // await this.kvLock
                // Persist raw bytes
                await this.state.storage.put(`c:${this.seq}`, value)
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

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createDurableObjectRequest(url: URL, req: Request) {
    // For /in-progress, the upstream URL is in the body.
    if (url.pathname === '/in-progress' && req.method === 'POST') {
        const body = (await req.clone().json()) as any

        const durableObjectKey = new URL(body.url)
        const requestForDO = req
        const key = durableObjectKey.toString()
        console.log(`Using DO with key: ${key}`)

        return { requestForDO, key }
    } else {
        // For other requests, extract host from path.
        const pathParts = url.pathname.split('/').filter(Boolean)
        const host = decodeURIComponent(pathParts.shift() || '')
        if (!host) {
            // This case should be handled by the root redirect but as a fallback.
            throw new Response('host not specified in path', {
                status: 400,
            })
        }

        const upstreamUrl = new URL(req.url)
        upstreamUrl.host = host
        upstreamUrl.pathname = '/' + pathParts.join('/')
        const durableObjectKey = upstreamUrl

        const requestForDO = new Request(durableObjectKey.toString(), req)
        const key = durableObjectKey.toString()
        console.log(`Using DO with key: ${key}`)

        return { requestForDO, key }
    }
}
