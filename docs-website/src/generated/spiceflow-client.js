import { createSpiceflowClient } from 'spiceflow/client';
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
