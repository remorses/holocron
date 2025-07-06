import { createSpiceflowClient, SpiceflowClient } from 'spiceflow/client'
import { DocsState, IframeRpcMessage } from 'docs-website/src/lib/docs-state'
import { debounce } from './utils'

export function createIframeRpcClient({
    iframeRef,
    targetOrigin,
    defaultTimeout = 3000,
}: {
    iframeRef: React.RefObject<HTMLIFrameElement | null>
    targetOrigin?: string
    defaultTimeout?: number
}) {
    const pendingRequests = new Map<
        string,
        {
            resolve: (value: any) => void
            reject: (error: any) => void
            timeout: NodeJS.Timeout
        }
    >()
    const usedIdempotenceIds = new Set<string>()

    docsRpcClient.setDocsState = (
        state: DocsState,
        idempotenceId?: string,
    ): Promise<any> => {
        console.log(`sending state to docs iframe`, state)
        // contentWindow is accessible even for cross-origin iframes, but you cannot access *properties* of the window if it's cross-origin.
        // Here, we just need to postMessage, which is allowed on cross-origin frames.
        const iframeWindow = iframeRef.current?.contentWindow
        if (!iframeWindow) throw new Error('iframe not ready')

        const id = crypto.randomUUID()

        const message: IframeRpcMessage = {
            id,
            state,
        }

        return new Promise((resolve, reject) => {
            // If idempotenceId is specified and already used, return resolved promise immediately
            if (idempotenceId && usedIdempotenceIds.has(idempotenceId)) {
                console.log(
                    `Idempotence ID ${idempotenceId} already used, skipping docs state set state`,
                )
                return Promise.resolve(undefined)
            }
            const timeout = setTimeout(() => {
                pendingRequests.delete(id)
                reject(
                    new Error(
                        `Request ${id} timed out after ${defaultTimeout}ms`,
                    ),
                )
            }, defaultTimeout)

            pendingRequests.set(id, { resolve, reject, timeout })

            iframeWindow.postMessage(message, {
                targetOrigin: targetOrigin,
            })
            if (idempotenceId) {
                usedIdempotenceIds.add(idempotenceId)
            }
        })
    }
    function onMessage(e: MessageEvent) {
        const { id, state, error } = (e.data ?? {}) as IframeRpcMessage

        if (!id) return

        const pending = pendingRequests.get(id)
        if (!pending) return

        pendingRequests.delete(id)
        clearTimeout(pending.timeout)

        if (error) {
            pending.reject(new Error(error))
        } else {
            pending.resolve(state)
        }
    }

    window.addEventListener('message', onMessage)
    docsRpcClient.cleanup = () => {
        window.removeEventListener('message', onMessage)
        // Clean up any pending requests
        for (const [id, pending] of pendingRequests) {
            clearTimeout(pending.timeout)
            pending.reject(new Error('RPC client cleanup'))
        }
        pendingRequests.clear()
        usedIdempotenceIds.clear()
    }
    return docsRpcClient
}

export let docsRpcClient = {
    async setDocsState(
        state: Partial<DocsState>,
        idempotenceId?: string,
    ): Promise<any> {
        console.error(new Error(`docs rpc client still not initialized`))
        return Promise.reject(
            new Error(`docs rpc client still not initialized`),
        )
    },
    cleanup() {},
}
