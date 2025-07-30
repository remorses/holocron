import { createSpiceflowClient } from 'spiceflow/client';
import { DurableFetchClient } from 'durablefetch';
export declare const apiClient: {
    api: ((request?: unknown, options?: {
        headers?: Record<string, unknown> | undefined;
        query?: Record<string, unknown> | undefined;
        fetch?: RequestInit | undefined;
    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
        [x: number]: unknown;
    }>>) | {
        [x: string]: ((request?: unknown, options?: {
            headers?: Record<string, unknown> | undefined;
            query?: Record<string, unknown> | undefined;
            fetch?: RequestInit | undefined;
        } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
            [x: number]: unknown;
        }>>) | /*elided*/ any;
    };
};
export declare function createApiClient(url: string, options?: Parameters<typeof createSpiceflowClient>[1]): {
    api: ((request?: unknown, options?: {
        headers?: Record<string, unknown> | undefined;
        query?: Record<string, unknown> | undefined;
        fetch?: RequestInit | undefined;
    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
        [x: number]: unknown;
    }>>) | {
        [x: string]: ((request?: unknown, options?: {
            headers?: Record<string, unknown> | undefined;
            query?: Record<string, unknown> | undefined;
            fetch?: RequestInit | undefined;
        } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
            [x: number]: unknown;
        }>>) | /*elided*/ any;
    };
};
export declare const durableFetchClient: DurableFetchClient;
export declare const apiClientWithDurableFetch: {
    api: ((request?: unknown, options?: {
        headers?: Record<string, unknown> | undefined;
        query?: Record<string, unknown> | undefined;
        fetch?: RequestInit | undefined;
    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
        [x: number]: unknown;
    }>>) | {
        [x: string]: ((request?: unknown, options?: {
            headers?: Record<string, unknown> | undefined;
            query?: Record<string, unknown> | undefined;
            fetch?: RequestInit | undefined;
        } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
            [x: number]: unknown;
        }>>) | /*elided*/ any;
    };
};
