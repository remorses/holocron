import { Spiceflow } from 'spiceflow'
import { openapi } from 'spiceflow/openapi'
import { env } from './env'

// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow()
    .use(openapi()) //
    .route({
        method: 'GET',
        path: '/health',
        handler() {
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            }
        },
    })

export type DocsWebsiteSpiceflowApp = typeof app

export type IframeRpcMessage = {
    id: string
    request?: { url: string; body: string; method: string }
    response?: { text: string }
    error?: string
}

const allowedOrigins = [env.NEXT_PUBLIC_URL!.replace(/\/$/, '')]

const onMessage = async (e: MessageEvent) => {
    // e.origin is a string representing the origin of the message, e.g., "https://example.com"
    if (!allowedOrigins.includes(e.origin)) {
        console.warn(`Blocked message from disallowed origin: ${e.origin}`)
        return
    }
    const data = e.data as IframeRpcMessage
    const { id, request } = data || {}
    try {
        if (!request) {
            throw new Error('Request is missing')
        }
        const response = await app.handle(
            new Request(request.url, {
                method: request.method,
                body: request.body || undefined,
            }),
        )
        e.source!.postMessage(
            {
                id,
                response: { text: await response.text() },
            } satisfies IframeRpcMessage,
            { targetOrigin: '*' },
        )
    } catch (err) {
        e.source!.postMessage(
            { id, error: (err as Error).message } satisfies IframeRpcMessage,
            { targetOrigin: '*' },
        )
    }
}
if (typeof window !== 'undefined') {
    window.addEventListener('message', onMessage)
}
