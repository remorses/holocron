import { createSpiceflowClient, SpiceflowClient } from 'spiceflow/client'
import { DocsState, IframeRpcMessage } from 'docs-website/src/lib/docs-state'
import { debounce } from './utils'
import { useWebsiteState } from './state'

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

  docsRpcClient.setDocsState = async ({ idempotenceKey, state, revalidate }): Promise<any> => {
    console.log(`sending state to docs iframe`, state)
    // contentWindow is accessible even for cross-origin iframes, but you cannot access *properties* of the window if it's cross-origin.
    // Here, we just need to postMessage, which is allowed on cross-origin frames.
    const iframeWindow = iframeRef.current?.contentWindow
    if (!iframeWindow) throw new Error('iframe not ready')

    useWebsiteState.setState({
      filesInDraft: {
        ...useWebsiteState.getState()?.filesInDraft,
        ...state?.filesInDraft,
      },
    })
    const id = crypto.randomUUID()

    const message: IframeRpcMessage = {
      id,
      state,
      revalidate,
    }

    return new Promise((resolve, reject) => {
      // If idempotenceId is specified and already used, return resolved promise immediately
      if (idempotenceKey && usedIdempotenceIds.has(idempotenceKey)) {
        console.log(`Idempotence ID ${idempotenceKey} already used, skipping docs state set state`)
        return Promise.resolve(undefined)
      }
      const timeout = setTimeout(() => {
        pendingRequests.delete(id)
        reject(new Error(`Request ${id} timed out after ${defaultTimeout}ms`))
      }, defaultTimeout)

      pendingRequests.set(id, { resolve, reject, timeout })

      iframeWindow.postMessage(message, {
        targetOrigin: targetOrigin,
      })
      if (idempotenceKey) {
        usedIdempotenceIds.add(idempotenceKey)
      }
    })
  }
  function onMessage(e: MessageEvent) {
    const { id, state, error } = (e.data ?? {}) as IframeRpcMessage

    if (state) {
      const prev = useWebsiteState.getState()
      useWebsiteState.setState({
        ...state,
        filesInDraft: {
          ...prev.filesInDraft,
          ...state.filesInDraft,
        },
      })
    }

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
  async setDocsState(state: Partial<IframeRpcMessage>): Promise<any> {
    console.warn(new Error(`docs rpc client still not initialized`))
  },
  cleanup() {},
}
