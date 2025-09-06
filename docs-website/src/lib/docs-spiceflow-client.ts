import { createSpiceflowClient } from 'spiceflow/client'
import { DocsSpiceflowApp } from './spiceflow-docs-app'
import { DurableFetchClient } from 'durablefetch'

export const docsApiClient = createSpiceflowClient<DocsSpiceflowApp>('/', {
  onRequest() {
    return { credentials: 'include' }
  },
})

export const docsDurableFetchClient = new DurableFetchClient()

export const docsApiClientWithDurableFetch =
  createSpiceflowClient<DocsSpiceflowApp>('/', {
    onRequest() {
      const authToken = document.cookie
        .split('; ')
        .find(
          (row) =>
            row.startsWith('session_token=') ||
            row.startsWith('__Secure-session_token='),
        )
        ?.split('=')[1]
        ?.trim()
      if (authToken) {
        return { headers: { Authorization: `Bearer ${authToken}` } }
      }
    },

    fetch:
      process.env.NODE_ENV !== 'development'
        ? docsDurableFetchClient.fetch
        : undefined,
  })
