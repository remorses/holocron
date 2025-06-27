import { createSpiceflowClient } from 'spiceflow/client'
import { SpiceflowApp } from './spiceflow'

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
