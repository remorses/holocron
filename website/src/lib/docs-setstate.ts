import { createSpiceflowClient, SpiceflowClient } from 'spiceflow/client'
import { DocsState, IframeRpcMessage } from 'docs-website/src/lib/docs-state'
import { debounce } from './utils'

export function createIframeRpcClient({
    iframeRef,
    targetOrigin,
    defaultTimeout = 5000,
}: {
    iframeRef: React.RefObject<HTMLIFrameElement | null>
    targetOrigin?: string
    defaultTimeout?: number
}) {
    docsRpcClient.setDocsState = debounce(50, (state: DocsState) => {
        // contentWindow is accessible even for cross-origin iframes, but you cannot access *properties* of the window if it's cross-origin.
        // Here, we just need to postMessage, which is allowed on cross-origin frames.
        const w = iframeRef.current?.contentWindow
        if (!w) throw new Error('iframe not ready')

        const id = crypto.randomUUID()

        const message: IframeRpcMessage = {
            id,
            state,
        }

        w.postMessage(message, {
            targetOrigin: '*',
        })
    })

    function onMessage(e: MessageEvent) {
        if (targetOrigin && e.origin !== targetOrigin) return
        const { id, state, error } = (e.data ?? {}) as IframeRpcMessage
    }

    window.addEventListener('message', onMessage)
    docsRpcClient.cleanup = () => {
        window.removeEventListener('message', onMessage)
    }
    return docsRpcClient
}

export let docsRpcClient = {
    setDocsState(state: Partial<DocsState>): any {
        console.error(new Error(`docs rpc client still not initialized`))
    },
    cleanup() {},
}
