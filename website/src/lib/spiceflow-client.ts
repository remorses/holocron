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
    '/',
    {
        onRequest() {
            return { credentials: 'include' }
        },

        fetch: durableFetchClient.fetch,
    },
)
