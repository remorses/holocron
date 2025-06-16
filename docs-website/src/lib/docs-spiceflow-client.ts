import { createSpiceflowClient, SpiceflowClient } from 'spiceflow/client'
import type { IframeRpcMessage } from './docs-spiceflow-server'
import { DocsWebsiteSpiceflowApp } from './docs-spiceflow-server'

export function createIframeRpcClient({
    iframeRef,
    targetOrigin,
    defaultTimeout = 5000,
}: {
    iframeRef: React.RefObject<HTMLIFrameElement | null>
    targetOrigin?: string
    defaultTimeout?: number
}) {
    const pending = new Map<
        string,
        {
            resolve: (r: Response) => void
            reject: (e: any) => void
            timer: number
        }
    >()

    /** Send a Request (or Request-init or URL) and receive a Response (same shape as fetch) */
    const fetch = (
        input: RequestInfo | URL,
        init?: RequestInit,
    ): Promise<Response> => {
        // contentWindow is accessible even for cross-origin iframes, but you cannot access *properties* of the window if it's cross-origin.
        // Here, we just need to postMessage, which is allowed on cross-origin frames.
        const w = iframeRef.current?.contentWindow
        if (!w) return Promise.reject(new Error('iframe not ready'))

        const id = crypto.randomUUID()

        let request: Request
        if (input instanceof Request) {
            request = input
        } else if (input instanceof URL) {
            request = new Request(input.toString(), init)
        } else {
            request = new Request(input, init)
        }

        return new Promise<Response>(async (resolve, reject) => {
            const timer = window.setTimeout(() => {
                pending.delete(id)
                reject(new Error('timeout'))
            }, defaultTimeout)

            pending.set(id, { resolve, reject, timer })
            const message: IframeRpcMessage = {
                id,
                request: {
                    url: request.url,
                    body: await request.text(),
                    method: request.method,
                },
            }

            w.postMessage(message, {
                targetOrigin: '*',
            })
        })
    }

    const client = createSpiceflowClient<DocsWebsiteSpiceflowApp>('/', {
        fetch,
        onRequest() {
            return { credentials: 'include' }
        },
    })

    function onMessage(e: MessageEvent) {
        if (targetOrigin && e.origin !== targetOrigin) return
        const { id, response, error } = (e.data ?? {}) as IframeRpcMessage
        const entry = pending.get(id)
        if (!entry) return

        clearTimeout(entry.timer)
        pending.delete(id)
        if (error) {
            entry.reject(new Error(error))
            return
        }
        if (!response) {
            throw new Error('Response is missing')
        }
        entry.resolve(new Response(response.text))
    }

    window.addEventListener('message', onMessage)
    const cleanup = () => {
        window.removeEventListener('message', onMessage)
        pending.forEach(({ reject, timer }) => {
            clearTimeout(timer)
            reject(new Error('cleaned up'))
        })
        pending.clear()
    }
    return { client, cleanup }
}

export type SpiceflowDocsClient =
    SpiceflowClient.Create<DocsWebsiteSpiceflowApp>
