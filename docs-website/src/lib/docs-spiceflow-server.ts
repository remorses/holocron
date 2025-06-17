import { Spiceflow } from 'spiceflow'
import { z } from 'zod'

import { openapi } from 'spiceflow/openapi'
import { env } from './env'

// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow()
    .use(openapi()) //
    .state('zustand')
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
    .route({
        method: 'POST',
        path: '/updatePage',
        request: z.object({
            markdown: z.string().min(1, 'Markdown content is required'),
            slug: z.string().min(1, 'Slug is required'),
        }),
        async handler({ request }) {
            const { markdown, slug } = await request.json()

            return {
                success: true,
                message: 'Page updated successfully',
                slug,
            }
        },
    })
    .route({
        method: 'DELETE',
        path: '/deletePage',
        request: z.object({
            slug: z.string().min(1, 'Slug is required'),
        }),
        async handler({ request }) {
            const { slug } = await request.json()

            // TODO: Implement page deletion logic

            return {
                success: true,
                message: 'Page deleted successfully',
                slug,
            }
        },
    })
    .route({
        method: 'POST',
        path: '/addNewPage',
        request: z.object({
            slug: z.string().min(1, 'Slug is required'),
            markdown: z.string().min(1, 'Markdown content is required'),
        }),
        async handler({ request }) {
            const { slug, markdown } = await request.json()

            // TODO: Implement new page creation logic

            return {
                success: true,
                message: 'New page created successfully',
                slug,
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
