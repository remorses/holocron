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
        v1: {
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
            sites: {
                create: {
                    post: (request: {
                        name: string;
                        orgId: string;
                        files: {
                            relativePath: string;
                            contents: string;
                            downloadUrl?: string | undefined;
                            metadata?: {
                                width?: number | undefined;
                                height?: number | undefined;
                            } | undefined;
                        }[];
                        githubOwner?: string | undefined;
                        githubRepo?: string | undefined;
                        githubRepoId?: number | undefined;
                        githubBranch?: string | undefined;
                        githubFolder?: string | undefined;
                        metadata?: Record<string, any> | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            branchId: string;
                            chatId: string;
                            docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                            errors: {
                                githubPath: string;
                                line: number;
                                errorMessage: string;
                                errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                            }[];
                        };
                    }>>;
                };
                sync: {
                    post: (request: {
                        siteId: string;
                        files: {
                            relativePath: string;
                            contents: string;
                            downloadUrl?: string | undefined;
                            metadata?: {
                                width?: number | undefined;
                                height?: number | undefined;
                            } | undefined;
                        }[];
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            branchId: string;
                            pageCount: number;
                            docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                            errors: {
                                githubPath: string;
                                line: number;
                                errorMessage: string;
                                errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                            }[];
                        };
                    }>>;
                };
                deleteFiles: {
                    post: (request: {
                        siteId: string;
                        filePaths: string[];
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            deletedCount: number;
                            deletedPages: number;
                            deletedMediaAssets: number;
                            deletedMetaFiles: number;
                        };
                    }>>;
                };
                update: {
                    post: (request: {
                        siteId: string;
                        name?: string | undefined;
                        visibility?: "public" | "private" | undefined;
                        githubOwner?: string | undefined;
                        githubRepo?: string | undefined;
                        githubFolder?: string | undefined;
                        metadata?: Record<string, any> | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            name: string;
                            visibility: import("db/src/generated/enums").SiteVisibility;
                        };
                    }>>;
                };
                list: {
                    post: (request: {
                        metadata: import("db").JsonFilter<"Site"> | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            sites: {
                                siteId: string;
                                name: string | null;
                                visibility: import("db/src/generated/enums").SiteVisibility;
                                githubOwner: string | null;
                                githubRepo: string | null;
                                githubFolder: string;
                                metadata: import("@prisma/client/runtime/client").JsonValue;
                                createdAt: Date;
                            }[];
                        };
                    }>>;
                };
                get: {
                    post: (request: {
                        siteId: string;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            metadata: Record<string, any>;
                            branch: {
                                docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                                docsJsonComments: Record<string, any>;
                                domains: {
                                    branchId: string | null;
                                    id: string;
                                    host: string;
                                    domainType: import("db/src/generated/enums").DomainType;
                                }[];
                                branchId: string;
                                siteId: string;
                                title: string;
                                createdAt: Date;
                                githubBranch: string;
                                updatedAt: Date;
                                cssStyles: string;
                                lastGithubSyncAt: Date | null;
                                lastGithubSyncCommit: string | null;
                            };
                            domains: {
                                branchId: string | null;
                                id: string;
                                host: string;
                                domainType: import("db/src/generated/enums").DomainType;
                            }[];
                            branches: ({
                                domains: {
                                    branchId: string | null;
                                    id: string;
                                    host: string;
                                    domainType: import("db/src/generated/enums").DomainType;
                                }[];
                            } & {
                                branchId: string;
                                siteId: string;
                                title: string;
                                docsJson: import("@prisma/client/runtime/client").JsonValue;
                                createdAt: Date;
                                githubBranch: string;
                                updatedAt: Date;
                                docsJsonComments: import("@prisma/client/runtime/client").JsonValue;
                                cssStyles: string;
                                lastGithubSyncAt: Date | null;
                                lastGithubSyncCommit: string | null;
                            })[];
                            orgId: string;
                            name: string | null;
                            siteId: string;
                            visibility: import("db/src/generated/enums").SiteVisibility;
                            githubFolder: string;
                            createdAt: Date;
                            defaultLocale: string;
                            githubOwner: string | null;
                            githubRepo: string | null;
                            githubRepoId: number;
                        };
                    }>>;
                };
                delete: {
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
                        };
                    }>>;
                };
                pages: {
                    post: (request: {
                        siteId: string;
                        withFrontmatter?: boolean | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            branchId: string;
                            pages: {
                                createdAt: Date;
                                lastEditedAt: Date | null;
                                frontmatter?: Record<string, any> | undefined;
                                pageId: string;
                                slug: string;
                                githubPath: string;
                                githubSha: string | null;
                            }[];
                        };
                    }>>;
                };
            };
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
                    content: string | undefined;
                };
            }>>;
        };
        generateMessage: {
            post: (request: {
                messages: import("./types").WebsiteUIMessage[];
                siteId: string;
                chatId: string;
                branchId: string;
                githubFolder: string;
                currentSlug: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
                todos?: {
                    content: string;
                    status: "pending" | "in_progress" | "completed" | "cancelled";
                    priority: "high" | "low" | "medium";
                    id: string;
                }[] | undefined;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: AsyncGenerator<import("ai").InferUIMessageChunk<import("./types").WebsiteUIMessage>, void, unknown>;
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
                branchId: string;
                url: string;
                opinion: "good" | "bad";
                message: string;
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
        updateChatFilesInDraft: {
            post: (request: {
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
                    success: boolean;
                };
            }>>;
        };
        saveChangesForChat: {
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
                    success: boolean;
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
                files: {
                    relativePath: string;
                    contents: string;
                    downloadUrl?: string | undefined;
                    metadata?: {
                        width?: number | undefined;
                        height?: number | undefined;
                    } | undefined;
                }[];
                orgId: string;
                githubOwner?: string | undefined;
                githubRepo?: string | undefined;
                githubRepoId?: number | undefined;
                githubBranch?: string | undefined;
                githubFolder?: string | undefined;
                siteId?: string | undefined;
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
                    docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                    errors: {
                        githubPath: string;
                        line: number;
                        errorMessage: string;
                        errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                    }[];
                    orgId?: string | undefined;
                    name?: string | null | undefined;
                    metadata?: import("@prisma/client/runtime/client").JsonValue | undefined;
                    visibility?: import("db/src/generated/enums").SiteVisibility | undefined;
                    githubFolder?: string | undefined;
                    createdAt?: Date | undefined;
                    defaultLocale?: string | undefined;
                    githubOwner?: string | null | undefined;
                    githubRepo?: string | null | undefined;
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
                        content: string;
                        filePath: string;
                        encoding?: undefined;
                    } | {
                        content: string;
                        filePath: string;
                        encoding: string;
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
        getRepoBranches: {
            post: (request: {
                orgId: string;
                owner: string;
                repo: string;
                installationId: number;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    branches: {
                        name: string;
                        isDefault: boolean;
                    }[];
                    defaultBranch: string;
                };
            }>>;
        };
        updateSiteVisibility: {
            post: (request: {
                siteId: string;
                visibility: "public" | "private";
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    siteId: string;
                    visibility: import("db/src/generated/enums").SiteVisibility;
                    message: string;
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
                SERVICE_SECRET: string;
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
        v1: {
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
            sites: {
                create: {
                    post: (request: {
                        name: string;
                        orgId: string;
                        files: {
                            relativePath: string;
                            contents: string;
                            downloadUrl?: string | undefined;
                            metadata?: {
                                width?: number | undefined;
                                height?: number | undefined;
                            } | undefined;
                        }[];
                        githubOwner?: string | undefined;
                        githubRepo?: string | undefined;
                        githubRepoId?: number | undefined;
                        githubBranch?: string | undefined;
                        githubFolder?: string | undefined;
                        metadata?: Record<string, any> | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            branchId: string;
                            chatId: string;
                            docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                            errors: {
                                githubPath: string;
                                line: number;
                                errorMessage: string;
                                errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                            }[];
                        };
                    }>>;
                };
                sync: {
                    post: (request: {
                        siteId: string;
                        files: {
                            relativePath: string;
                            contents: string;
                            downloadUrl?: string | undefined;
                            metadata?: {
                                width?: number | undefined;
                                height?: number | undefined;
                            } | undefined;
                        }[];
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            branchId: string;
                            pageCount: number;
                            docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                            errors: {
                                githubPath: string;
                                line: number;
                                errorMessage: string;
                                errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                            }[];
                        };
                    }>>;
                };
                deleteFiles: {
                    post: (request: {
                        siteId: string;
                        filePaths: string[];
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            deletedCount: number;
                            deletedPages: number;
                            deletedMediaAssets: number;
                            deletedMetaFiles: number;
                        };
                    }>>;
                };
                update: {
                    post: (request: {
                        siteId: string;
                        name?: string | undefined;
                        visibility?: "public" | "private" | undefined;
                        githubOwner?: string | undefined;
                        githubRepo?: string | undefined;
                        githubFolder?: string | undefined;
                        metadata?: Record<string, any> | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            name: string;
                            visibility: import("db/src/generated/enums").SiteVisibility;
                        };
                    }>>;
                };
                list: {
                    post: (request: {
                        metadata: import("db").JsonFilter<"Site"> | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            sites: {
                                siteId: string;
                                name: string | null;
                                visibility: import("db/src/generated/enums").SiteVisibility;
                                githubOwner: string | null;
                                githubRepo: string | null;
                                githubFolder: string;
                                metadata: import("@prisma/client/runtime/client").JsonValue;
                                createdAt: Date;
                            }[];
                        };
                    }>>;
                };
                get: {
                    post: (request: {
                        siteId: string;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            metadata: Record<string, any>;
                            branch: {
                                docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                                docsJsonComments: Record<string, any>;
                                domains: {
                                    branchId: string | null;
                                    id: string;
                                    host: string;
                                    domainType: import("db/src/generated/enums").DomainType;
                                }[];
                                branchId: string;
                                siteId: string;
                                title: string;
                                createdAt: Date;
                                githubBranch: string;
                                updatedAt: Date;
                                cssStyles: string;
                                lastGithubSyncAt: Date | null;
                                lastGithubSyncCommit: string | null;
                            };
                            domains: {
                                branchId: string | null;
                                id: string;
                                host: string;
                                domainType: import("db/src/generated/enums").DomainType;
                            }[];
                            branches: ({
                                domains: {
                                    branchId: string | null;
                                    id: string;
                                    host: string;
                                    domainType: import("db/src/generated/enums").DomainType;
                                }[];
                            } & {
                                branchId: string;
                                siteId: string;
                                title: string;
                                docsJson: import("@prisma/client/runtime/client").JsonValue;
                                createdAt: Date;
                                githubBranch: string;
                                updatedAt: Date;
                                docsJsonComments: import("@prisma/client/runtime/client").JsonValue;
                                cssStyles: string;
                                lastGithubSyncAt: Date | null;
                                lastGithubSyncCommit: string | null;
                            })[];
                            orgId: string;
                            name: string | null;
                            siteId: string;
                            visibility: import("db/src/generated/enums").SiteVisibility;
                            githubFolder: string;
                            createdAt: Date;
                            defaultLocale: string;
                            githubOwner: string | null;
                            githubRepo: string | null;
                            githubRepoId: number;
                        };
                    }>>;
                };
                delete: {
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
                        };
                    }>>;
                };
                pages: {
                    post: (request: {
                        siteId: string;
                        withFrontmatter?: boolean | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            branchId: string;
                            pages: {
                                createdAt: Date;
                                lastEditedAt: Date | null;
                                frontmatter?: Record<string, any> | undefined;
                                pageId: string;
                                slug: string;
                                githubPath: string;
                                githubSha: string | null;
                            }[];
                        };
                    }>>;
                };
            };
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
                    content: string | undefined;
                };
            }>>;
        };
        generateMessage: {
            post: (request: {
                messages: import("./types").WebsiteUIMessage[];
                siteId: string;
                chatId: string;
                branchId: string;
                githubFolder: string;
                currentSlug: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
                todos?: {
                    content: string;
                    status: "pending" | "in_progress" | "completed" | "cancelled";
                    priority: "high" | "low" | "medium";
                    id: string;
                }[] | undefined;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: AsyncGenerator<import("ai").InferUIMessageChunk<import("./types").WebsiteUIMessage>, void, unknown>;
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
                branchId: string;
                url: string;
                opinion: "good" | "bad";
                message: string;
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
        updateChatFilesInDraft: {
            post: (request: {
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
                    success: boolean;
                };
            }>>;
        };
        saveChangesForChat: {
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
                    success: boolean;
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
                files: {
                    relativePath: string;
                    contents: string;
                    downloadUrl?: string | undefined;
                    metadata?: {
                        width?: number | undefined;
                        height?: number | undefined;
                    } | undefined;
                }[];
                orgId: string;
                githubOwner?: string | undefined;
                githubRepo?: string | undefined;
                githubRepoId?: number | undefined;
                githubBranch?: string | undefined;
                githubFolder?: string | undefined;
                siteId?: string | undefined;
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
                    docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                    errors: {
                        githubPath: string;
                        line: number;
                        errorMessage: string;
                        errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                    }[];
                    orgId?: string | undefined;
                    name?: string | null | undefined;
                    metadata?: import("@prisma/client/runtime/client").JsonValue | undefined;
                    visibility?: import("db/src/generated/enums").SiteVisibility | undefined;
                    githubFolder?: string | undefined;
                    createdAt?: Date | undefined;
                    defaultLocale?: string | undefined;
                    githubOwner?: string | null | undefined;
                    githubRepo?: string | null | undefined;
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
                        content: string;
                        filePath: string;
                        encoding?: undefined;
                    } | {
                        content: string;
                        filePath: string;
                        encoding: string;
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
        getRepoBranches: {
            post: (request: {
                orgId: string;
                owner: string;
                repo: string;
                installationId: number;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    branches: {
                        name: string;
                        isDefault: boolean;
                    }[];
                    defaultBranch: string;
                };
            }>>;
        };
        updateSiteVisibility: {
            post: (request: {
                siteId: string;
                visibility: "public" | "private";
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    siteId: string;
                    visibility: import("db/src/generated/enums").SiteVisibility;
                    message: string;
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
                SERVICE_SECRET: string;
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
        v1: {
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
            sites: {
                create: {
                    post: (request: {
                        name: string;
                        orgId: string;
                        files: {
                            relativePath: string;
                            contents: string;
                            downloadUrl?: string | undefined;
                            metadata?: {
                                width?: number | undefined;
                                height?: number | undefined;
                            } | undefined;
                        }[];
                        githubOwner?: string | undefined;
                        githubRepo?: string | undefined;
                        githubRepoId?: number | undefined;
                        githubBranch?: string | undefined;
                        githubFolder?: string | undefined;
                        metadata?: Record<string, any> | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            branchId: string;
                            chatId: string;
                            docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                            errors: {
                                githubPath: string;
                                line: number;
                                errorMessage: string;
                                errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                            }[];
                        };
                    }>>;
                };
                sync: {
                    post: (request: {
                        siteId: string;
                        files: {
                            relativePath: string;
                            contents: string;
                            downloadUrl?: string | undefined;
                            metadata?: {
                                width?: number | undefined;
                                height?: number | undefined;
                            } | undefined;
                        }[];
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            branchId: string;
                            pageCount: number;
                            docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                            errors: {
                                githubPath: string;
                                line: number;
                                errorMessage: string;
                                errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                            }[];
                        };
                    }>>;
                };
                deleteFiles: {
                    post: (request: {
                        siteId: string;
                        filePaths: string[];
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            deletedCount: number;
                            deletedPages: number;
                            deletedMediaAssets: number;
                            deletedMetaFiles: number;
                        };
                    }>>;
                };
                update: {
                    post: (request: {
                        siteId: string;
                        name?: string | undefined;
                        visibility?: "public" | "private" | undefined;
                        githubOwner?: string | undefined;
                        githubRepo?: string | undefined;
                        githubFolder?: string | undefined;
                        metadata?: Record<string, any> | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            name: string;
                            visibility: import("db/src/generated/enums").SiteVisibility;
                        };
                    }>>;
                };
                list: {
                    post: (request: {
                        metadata: import("db").JsonFilter<"Site"> | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            sites: {
                                siteId: string;
                                name: string | null;
                                visibility: import("db/src/generated/enums").SiteVisibility;
                                githubOwner: string | null;
                                githubRepo: string | null;
                                githubFolder: string;
                                metadata: import("@prisma/client/runtime/client").JsonValue;
                                createdAt: Date;
                            }[];
                        };
                    }>>;
                };
                get: {
                    post: (request: {
                        siteId: string;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            metadata: Record<string, any>;
                            branch: {
                                docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                                docsJsonComments: Record<string, any>;
                                domains: {
                                    branchId: string | null;
                                    id: string;
                                    host: string;
                                    domainType: import("db/src/generated/enums").DomainType;
                                }[];
                                branchId: string;
                                siteId: string;
                                title: string;
                                createdAt: Date;
                                githubBranch: string;
                                updatedAt: Date;
                                cssStyles: string;
                                lastGithubSyncAt: Date | null;
                                lastGithubSyncCommit: string | null;
                            };
                            domains: {
                                branchId: string | null;
                                id: string;
                                host: string;
                                domainType: import("db/src/generated/enums").DomainType;
                            }[];
                            branches: ({
                                domains: {
                                    branchId: string | null;
                                    id: string;
                                    host: string;
                                    domainType: import("db/src/generated/enums").DomainType;
                                }[];
                            } & {
                                branchId: string;
                                siteId: string;
                                title: string;
                                docsJson: import("@prisma/client/runtime/client").JsonValue;
                                createdAt: Date;
                                githubBranch: string;
                                updatedAt: Date;
                                docsJsonComments: import("@prisma/client/runtime/client").JsonValue;
                                cssStyles: string;
                                lastGithubSyncAt: Date | null;
                                lastGithubSyncCommit: string | null;
                            })[];
                            orgId: string;
                            name: string | null;
                            siteId: string;
                            visibility: import("db/src/generated/enums").SiteVisibility;
                            githubFolder: string;
                            createdAt: Date;
                            defaultLocale: string;
                            githubOwner: string | null;
                            githubRepo: string | null;
                            githubRepoId: number;
                        };
                    }>>;
                };
                delete: {
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
                        };
                    }>>;
                };
                pages: {
                    post: (request: {
                        siteId: string;
                        withFrontmatter?: boolean | undefined;
                    }, options?: {
                        headers?: Record<string, unknown> | undefined;
                        query?: Record<string, unknown> | undefined;
                        fetch?: RequestInit | undefined;
                    } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                        200: {
                            success: boolean;
                            siteId: string;
                            branchId: string;
                            pages: {
                                createdAt: Date;
                                lastEditedAt: Date | null;
                                frontmatter?: Record<string, any> | undefined;
                                pageId: string;
                                slug: string;
                                githubPath: string;
                                githubSha: string | null;
                            }[];
                        };
                    }>>;
                };
            };
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
                    content: string | undefined;
                };
            }>>;
        };
        generateMessage: {
            post: (request: {
                messages: import("./types").WebsiteUIMessage[];
                siteId: string;
                chatId: string;
                branchId: string;
                githubFolder: string;
                currentSlug: string;
                filesInDraft: Record<string, {
                    githubPath: string;
                    content: string | null;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                }>;
                todos?: {
                    content: string;
                    status: "pending" | "in_progress" | "completed" | "cancelled";
                    priority: "high" | "low" | "medium";
                    id: string;
                }[] | undefined;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: AsyncGenerator<import("ai").InferUIMessageChunk<import("./types").WebsiteUIMessage>, void, unknown>;
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
                branchId: string;
                url: string;
                opinion: "good" | "bad";
                message: string;
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
        updateChatFilesInDraft: {
            post: (request: {
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
                    success: boolean;
                };
            }>>;
        };
        saveChangesForChat: {
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
                    success: boolean;
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
                files: {
                    relativePath: string;
                    contents: string;
                    downloadUrl?: string | undefined;
                    metadata?: {
                        width?: number | undefined;
                        height?: number | undefined;
                    } | undefined;
                }[];
                orgId: string;
                githubOwner?: string | undefined;
                githubRepo?: string | undefined;
                githubRepoId?: number | undefined;
                githubBranch?: string | undefined;
                githubFolder?: string | undefined;
                siteId?: string | undefined;
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
                    docsJson: import("@holocron.so/cli/src").HolocronJsonc;
                    errors: {
                        githubPath: string;
                        line: number;
                        errorMessage: string;
                        errorType: import("db/src/generated/enums").MarkdownPageSyncErrorType;
                    }[];
                    orgId?: string | undefined;
                    name?: string | null | undefined;
                    metadata?: import("@prisma/client/runtime/client").JsonValue | undefined;
                    visibility?: import("db/src/generated/enums").SiteVisibility | undefined;
                    githubFolder?: string | undefined;
                    createdAt?: Date | undefined;
                    defaultLocale?: string | undefined;
                    githubOwner?: string | null | undefined;
                    githubRepo?: string | null | undefined;
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
                        content: string;
                        filePath: string;
                        encoding?: undefined;
                    } | {
                        content: string;
                        filePath: string;
                        encoding: string;
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
        getRepoBranches: {
            post: (request: {
                orgId: string;
                owner: string;
                repo: string;
                installationId: number;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    branches: {
                        name: string;
                        isDefault: boolean;
                    }[];
                    defaultBranch: string;
                };
            }>>;
        };
        updateSiteVisibility: {
            post: (request: {
                siteId: string;
                visibility: "public" | "private";
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    siteId: string;
                    visibility: import("db/src/generated/enums").SiteVisibility;
                    message: string;
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
                SERVICE_SECRET: string;
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
