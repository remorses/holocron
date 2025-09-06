import { createSpiceflowClient } from 'spiceflow/client'
import { SpiceflowApp } from './spiceflow'
import { DurableFetchClient } from 'durablefetch'

export const apiClient = createSpiceflowClient<SpiceflowApp>('/', {
  onRequest() {
    return { credentials: 'include' }
  },
})
export function createApiClient(
  url: string,
  options?: Parameters<typeof createSpiceflowClient>[1],
) {
  return createSpiceflowClient<SpiceflowApp>(url, {
    // onRequest() {
    //     return { credentials: 'include' };
    // },
    ...options,
  })
}

export const durableFetchClient = new DurableFetchClient()

export const apiClientWithDurableFetch = createSpiceflowClient<SpiceflowApp>(
  process.env.PUBLIC_URL!,
  {
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

    // fetch: durableFetchClient.fetch,
  },
)
