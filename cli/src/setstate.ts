import type {
    DocsState,
    IframeRpcMessage,
} from 'docs-website/src/lib/docs-state.js'
import type { WebSocket } from 'ws'

export function createIframeRpcClient({
    ws,
    defaultTimeout = 1000 * 5,
}: {
    ws: WebSocket
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
        if (!ws || ws.readyState !== 1) {
            throw new Error('WebSocket instance not open.')
        }

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

            ws.send(JSON.stringify(message))
            if (idempotenceId) {
                usedIdempotenceIds.add(idempotenceId)
            }
        })
    }
    function onMessage(data: WebSocket.RawData, isBinary: boolean) {
        let msg: IframeRpcMessage | undefined
        try {
            // Only parse if not binary
            if (isBinary) return
            msg = JSON.parse(data.toString())
        } catch (err) {
            // ignore parse errors
            return
        }
        if (!msg) return
        const { id, state, error } = msg

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

    // Attach ws 'message' event handler
    // handle multiple calls gracefully
    function messageHandler(data: WebSocket.RawData, isBinary: boolean) {
        onMessage(data, isBinary)
    }

    ws.on('message', messageHandler)
    docsRpcClient.cleanup = () => {
        ws.off('message', messageHandler)
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

let docsRpcClient = {
    async setDocsState(
        state: Partial<DocsState>,
        idempotenceId?: string,
    ): Promise<any> {
        console.error(new Error(`docs rpc client still not initialized`))

    },
    cleanup() {},
}
