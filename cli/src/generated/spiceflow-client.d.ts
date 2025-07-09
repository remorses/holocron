import { createSpiceflowClient } from 'spiceflow/client';
import { DurableFetchClient } from 'durablefetch';
export declare const apiClient: {
    api: {
        openapi: {
            get: (options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                [x: number]: any;
                200: any;
            }>>;
        };
        health: {
            get: (options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    status: string;
                    timestamp: string;
                    uptime: number;
                };
            }>>;
        };
        getPageContent: {
            post: (request: {
                branchId: string;
                githubPath: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    content: string;
                };
            }>>;
        };
        generateMessage: {
            post: (request: {
                branchId: string;
                siteId: string;
                messages: import("ai").UIMessage<unknown, import("ai").UIDataTypes, import("ai").UITools>[];
                chatId: string;
                currentSlug: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: AsyncGenerator<{
                    type: "text-start";
                    id: string;
                } | {
                    type: "text-delta";
                    delta: string;
                    id: string;
                } | {
                    type: "text-end";
                    id: string;
                } | {
                    type: "reasoning-start";
                    id: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "reasoning-delta";
                    id: string;
                    delta: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "reasoning-end";
                    id: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "error";
                    errorText: string;
                } | {
                    type: "tool-input-available";
                    toolCallId: string;
                    toolName: string;
                    input: unknown;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-output-available";
                    toolCallId: string;
                    output: unknown;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-output-error";
                    toolCallId: string;
                    errorText: string;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-input-start";
                    toolCallId: string;
                    toolName: string;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-input-delta";
                    toolCallId: string;
                    inputTextDelta: string;
                } | {
                    type: "source-url";
                    sourceId: string;
                    url: string;
                    title?: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "source-document";
                    sourceId: string;
                    mediaType: string;
                    title: string;
                    filename?: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "file";
                    url: string;
                    mediaType: string;
                } | {
                    type: "start-step";
                } | {
                    type: "finish-step";
                } | {
                    type: `data-${string}`;
                    id?: string;
                    data: unknown;
                    transient?: boolean;
                } | {
                    type: "start";
                    messageId?: string;
                    messageMetadata?: unknown;
                } | {
                    type: "finish";
                    messageMetadata?: unknown;
                } | {
                    type: "message-metadata";
                    messageMetadata: unknown;
                }, void, any>;
            }>>;
        };
        githubSync: {
            post: (request: {
                siteId: string;
                githubBranch: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    siteId: string;
                    branchId: string;
                    githubBranch: string;
                    message: string;
                };
            }>>;
        };
        createUploadSignedUrl: {
            post: (request: {
                siteId: string;
                files: {
                    slug: string;
                    contentLength: number;
                    contentType?: string | undefined;
                }[];
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    files: {
                        path: string;
                        signedUrl: string;
                        finalUrl: string;
                    }[];
                };
            }>>;
        };
        newChat: {
            post: (request: {
                branchId: string;
                orgId: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    chatId: string;
                };
            }>>;
        };
        submitRateFeedback: {
            post: (request: {
                message: string;
                branchId: string;
                url: string;
                opinion: "good" | "bad";
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    githubUrl: string;
                };
            }>>;
        };
        commitChangesToRepo: {
            post: (request: {
                branchId: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    prUrl: string;
                    commitUrl: string;
                    githubAuthUrl: string;
                };
            }>>;
        };
        createPrSuggestionForChat: {
            post: (request: {
                branchId: string;
                chatId: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    prUrl: string;
                };
            }>>;
        };
        getCliSession: {
            post: (request: {
                secret: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    apiKey?: undefined;
                    userId?: undefined;
                    userEmail?: undefined;
                    orgs?: undefined;
                } | {
                    apiKey: string;
                    userId: string;
                    userEmail: string;
                    orgs: {
                        orgId: string;
                        name: string;
                    }[];
                };
            }>>;
        };
        upsertSiteFromFiles: {
            post: (request: {
                name: string;
                orgId: string;
                files: {
                    relativePath: string;
                    contents: string;
                    metadata?: {
                        width?: number | undefined;
                        height?: number | undefined;
                    } | undefined;
                    downloadUrl?: string | undefined;
                }[];
                siteId?: string | undefined;
                githubBranch?: string | undefined;
                githubFolder?: string | undefined;
                githubOwner?: string | undefined;
                githubRepo?: string | undefined;
                githubRepoId?: number | undefined;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    docsJsonWithComments: string;
                    siteId: string;
                    branchId: string;
                    docsJson: import("docs-website/src/lib/docs-json").DocsJsonType;
                    errors: {
                        githubPath: string;
                        line: number;
                        errorMessage: string;
                        errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                    }[];
                    createdAt?: Date | undefined;
                    name?: string | null | undefined;
                    orgId?: string | undefined;
                    defaultLocale?: string | undefined;
                    githubFolder?: string | undefined;
                    githubOwner?: string | undefined;
                    githubRepo?: string | undefined;
                    githubRepoId?: number | undefined;
                };
            }>>;
        };
        getStarterTemplate: {
            get: (options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    files: ({
                        contents: string;
                        relativePath: string;
                        downloadUrl?: undefined;
                    } | {
                        contents: string;
                        relativePath: string;
                        downloadUrl: string;
                    })[];
                };
            }>>;
        };
        transcribeAudio: {
            post: (request?: unknown, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    text: string;
                };
            }>>;
        };
        deleteWebsite: {
            post: (request: {
                siteId: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    message: string;
                    siteId: string;
                };
            }>>;
        };
        databaseNightlyCleanup: {
            post: (request: {
                SECRET: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    message: string;
                    deletedCount: number;
                };
            }>>;
        };
    };
};
export declare function createApiClient(url: string, options?: Parameters<typeof createSpiceflowClient>[1]): {
    api: {
        openapi: {
            get: (options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                [x: number]: any;
                200: any;
            }>>;
        };
        health: {
            get: (options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    status: string;
                    timestamp: string;
                    uptime: number;
                };
            }>>;
        };
        getPageContent: {
            post: (request: {
                branchId: string;
                githubPath: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    content: string;
                };
            }>>;
        };
        generateMessage: {
            post: (request: {
                branchId: string;
                siteId: string;
                messages: import("ai").UIMessage<unknown, import("ai").UIDataTypes, import("ai").UITools>[];
                chatId: string;
                currentSlug: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: AsyncGenerator<{
                    type: "text-start";
                    id: string;
                } | {
                    type: "text-delta";
                    delta: string;
                    id: string;
                } | {
                    type: "text-end";
                    id: string;
                } | {
                    type: "reasoning-start";
                    id: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "reasoning-delta";
                    id: string;
                    delta: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "reasoning-end";
                    id: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "error";
                    errorText: string;
                } | {
                    type: "tool-input-available";
                    toolCallId: string;
                    toolName: string;
                    input: unknown;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-output-available";
                    toolCallId: string;
                    output: unknown;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-output-error";
                    toolCallId: string;
                    errorText: string;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-input-start";
                    toolCallId: string;
                    toolName: string;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-input-delta";
                    toolCallId: string;
                    inputTextDelta: string;
                } | {
                    type: "source-url";
                    sourceId: string;
                    url: string;
                    title?: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "source-document";
                    sourceId: string;
                    mediaType: string;
                    title: string;
                    filename?: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "file";
                    url: string;
                    mediaType: string;
                } | {
                    type: "start-step";
                } | {
                    type: "finish-step";
                } | {
                    type: `data-${string}`;
                    id?: string;
                    data: unknown;
                    transient?: boolean;
                } | {
                    type: "start";
                    messageId?: string;
                    messageMetadata?: unknown;
                } | {
                    type: "finish";
                    messageMetadata?: unknown;
                } | {
                    type: "message-metadata";
                    messageMetadata: unknown;
                }, void, any>;
            }>>;
        };
        githubSync: {
            post: (request: {
                siteId: string;
                githubBranch: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    siteId: string;
                    branchId: string;
                    githubBranch: string;
                    message: string;
                };
            }>>;
        };
        createUploadSignedUrl: {
            post: (request: {
                siteId: string;
                files: {
                    slug: string;
                    contentLength: number;
                    contentType?: string | undefined;
                }[];
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    files: {
                        path: string;
                        signedUrl: string;
                        finalUrl: string;
                    }[];
                };
            }>>;
        };
        newChat: {
            post: (request: {
                branchId: string;
                orgId: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    chatId: string;
                };
            }>>;
        };
        submitRateFeedback: {
            post: (request: {
                message: string;
                branchId: string;
                url: string;
                opinion: "good" | "bad";
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    githubUrl: string;
                };
            }>>;
        };
        commitChangesToRepo: {
            post: (request: {
                branchId: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    prUrl: string;
                    commitUrl: string;
                    githubAuthUrl: string;
                };
            }>>;
        };
        createPrSuggestionForChat: {
            post: (request: {
                branchId: string;
                chatId: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    prUrl: string;
                };
            }>>;
        };
        getCliSession: {
            post: (request: {
                secret: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    apiKey?: undefined;
                    userId?: undefined;
                    userEmail?: undefined;
                    orgs?: undefined;
                } | {
                    apiKey: string;
                    userId: string;
                    userEmail: string;
                    orgs: {
                        orgId: string;
                        name: string;
                    }[];
                };
            }>>;
        };
        upsertSiteFromFiles: {
            post: (request: {
                name: string;
                orgId: string;
                files: {
                    relativePath: string;
                    contents: string;
                    metadata?: {
                        width?: number | undefined;
                        height?: number | undefined;
                    } | undefined;
                    downloadUrl?: string | undefined;
                }[];
                siteId?: string | undefined;
                githubBranch?: string | undefined;
                githubFolder?: string | undefined;
                githubOwner?: string | undefined;
                githubRepo?: string | undefined;
                githubRepoId?: number | undefined;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    docsJsonWithComments: string;
                    siteId: string;
                    branchId: string;
                    docsJson: import("docs-website/src/lib/docs-json").DocsJsonType;
                    errors: {
                        githubPath: string;
                        line: number;
                        errorMessage: string;
                        errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                    }[];
                    createdAt?: Date | undefined;
                    name?: string | null | undefined;
                    orgId?: string | undefined;
                    defaultLocale?: string | undefined;
                    githubFolder?: string | undefined;
                    githubOwner?: string | undefined;
                    githubRepo?: string | undefined;
                    githubRepoId?: number | undefined;
                };
            }>>;
        };
        getStarterTemplate: {
            get: (options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    files: ({
                        contents: string;
                        relativePath: string;
                        downloadUrl?: undefined;
                    } | {
                        contents: string;
                        relativePath: string;
                        downloadUrl: string;
                    })[];
                };
            }>>;
        };
        transcribeAudio: {
            post: (request?: unknown, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    text: string;
                };
            }>>;
        };
        deleteWebsite: {
            post: (request: {
                siteId: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    message: string;
                    siteId: string;
                };
            }>>;
        };
        databaseNightlyCleanup: {
            post: (request: {
                SECRET: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    message: string;
                    deletedCount: number;
                };
            }>>;
        };
    };
};
export declare const durableFetchClient: DurableFetchClient;
export declare const apiClientWithDurableFetch: {
    api: {
        openapi: {
            get: (options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                [x: number]: any;
                200: any;
            }>>;
        };
        health: {
            get: (options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    status: string;
                    timestamp: string;
                    uptime: number;
                };
            }>>;
        };
        getPageContent: {
            post: (request: {
                branchId: string;
                githubPath: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    content: string;
                };
            }>>;
        };
        generateMessage: {
            post: (request: {
                branchId: string;
                siteId: string;
                messages: import("ai").UIMessage<unknown, import("ai").UIDataTypes, import("ai").UITools>[];
                chatId: string;
                currentSlug: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: AsyncGenerator<{
                    type: "text-start";
                    id: string;
                } | {
                    type: "text-delta";
                    delta: string;
                    id: string;
                } | {
                    type: "text-end";
                    id: string;
                } | {
                    type: "reasoning-start";
                    id: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "reasoning-delta";
                    id: string;
                    delta: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "reasoning-end";
                    id: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "error";
                    errorText: string;
                } | {
                    type: "tool-input-available";
                    toolCallId: string;
                    toolName: string;
                    input: unknown;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-output-available";
                    toolCallId: string;
                    output: unknown;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-output-error";
                    toolCallId: string;
                    errorText: string;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-input-start";
                    toolCallId: string;
                    toolName: string;
                    providerExecuted?: boolean;
                } | {
                    type: "tool-input-delta";
                    toolCallId: string;
                    inputTextDelta: string;
                } | {
                    type: "source-url";
                    sourceId: string;
                    url: string;
                    title?: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "source-document";
                    sourceId: string;
                    mediaType: string;
                    title: string;
                    filename?: string;
                    providerMetadata?: import("ai").ProviderMetadata;
                } | {
                    type: "file";
                    url: string;
                    mediaType: string;
                } | {
                    type: "start-step";
                } | {
                    type: "finish-step";
                } | {
                    type: `data-${string}`;
                    id?: string;
                    data: unknown;
                    transient?: boolean;
                } | {
                    type: "start";
                    messageId?: string;
                    messageMetadata?: unknown;
                } | {
                    type: "finish";
                    messageMetadata?: unknown;
                } | {
                    type: "message-metadata";
                    messageMetadata: unknown;
                }, void, any>;
            }>>;
        };
        githubSync: {
            post: (request: {
                siteId: string;
                githubBranch: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    siteId: string;
                    branchId: string;
                    githubBranch: string;
                    message: string;
                };
            }>>;
        };
        createUploadSignedUrl: {
            post: (request: {
                siteId: string;
                files: {
                    slug: string;
                    contentLength: number;
                    contentType?: string | undefined;
                }[];
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    files: {
                        path: string;
                        signedUrl: string;
                        finalUrl: string;
                    }[];
                };
            }>>;
        };
        newChat: {
            post: (request: {
                branchId: string;
                orgId: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    chatId: string;
                };
            }>>;
        };
        submitRateFeedback: {
            post: (request: {
                message: string;
                branchId: string;
                url: string;
                opinion: "good" | "bad";
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    githubUrl: string;
                };
            }>>;
        };
        commitChangesToRepo: {
            post: (request: {
                branchId: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    prUrl: string;
                    commitUrl: string;
                    githubAuthUrl: string;
                };
            }>>;
        };
        createPrSuggestionForChat: {
            post: (request: {
                branchId: string;
                chatId: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    prUrl: string;
                };
            }>>;
        };
        getCliSession: {
            post: (request: {
                secret: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    apiKey?: undefined;
                    userId?: undefined;
                    userEmail?: undefined;
                    orgs?: undefined;
                } | {
                    apiKey: string;
                    userId: string;
                    userEmail: string;
                    orgs: {
                        orgId: string;
                        name: string;
                    }[];
                };
            }>>;
        };
        upsertSiteFromFiles: {
            post: (request: {
                name: string;
                orgId: string;
                files: {
                    relativePath: string;
                    contents: string;
                    metadata?: {
                        width?: number | undefined;
                        height?: number | undefined;
                    } | undefined;
                    downloadUrl?: string | undefined;
                }[];
                siteId?: string | undefined;
                githubBranch?: string | undefined;
                githubFolder?: string | undefined;
                githubOwner?: string | undefined;
                githubRepo?: string | undefined;
                githubRepoId?: number | undefined;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    docsJsonWithComments: string;
                    siteId: string;
                    branchId: string;
                    docsJson: import("docs-website/src/lib/docs-json").DocsJsonType;
                    errors: {
                        githubPath: string;
                        line: number;
                        errorMessage: string;
                        errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                    }[];
                    createdAt?: Date | undefined;
                    name?: string | null | undefined;
                    orgId?: string | undefined;
                    defaultLocale?: string | undefined;
                    githubFolder?: string | undefined;
                    githubOwner?: string | undefined;
                    githubRepo?: string | undefined;
                    githubRepoId?: number | undefined;
                };
            }>>;
        };
        getStarterTemplate: {
            get: (options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    files: ({
                        contents: string;
                        relativePath: string;
                        downloadUrl?: undefined;
                    } | {
                        contents: string;
                        relativePath: string;
                        downloadUrl: string;
                    })[];
                };
            }>>;
        };
        transcribeAudio: {
            post: (request?: unknown, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    text: string;
                };
            }>>;
        };
        deleteWebsite: {
            post: (request: {
                siteId: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    message: string;
                    siteId: string;
                };
            }>>;
        };
        databaseNightlyCleanup: {
            post: (request: {
                SECRET: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    message: string;
                    deletedCount: number;
                };
            }>>;
        };
    };
};
