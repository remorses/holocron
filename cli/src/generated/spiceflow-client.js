import { createSpiceflowClient } from 'spiceflow/client';
import { DurableFetchClient } from 'durablefetch';
export const apiClient = createSpiceflowClient('/', {
    onRequest() {
        return { credentials: 'include' };
    },
});
export function createApiClient(url, options) {
    return createSpiceflowClient(url, {
        // onRequest() {
        //     return { credentials: 'include' };
        // },
        ...options,
    });
}
export const durableFetchClient = new DurableFetchClient();
export const apiClientWithDurableFetch = createSpiceflowClient('/', {
    onRequest() {
        return { credentials: 'include' };
    },
    fetch: durableFetchClient.fetch,
});
