import { createSpiceflowClient } from 'spiceflow/client';
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
                githubPath: string;
                branchId: string;
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
                siteId: string;
                chatId: string;
                messages: import("ai").UIMessage[];
                filesInDraft: Record<string, {
                    content: string;
                    githubPath: string;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                } | null>;
                currentSlug: string;
                branchId: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: AsyncGenerator<import("ai").TextStreamPart<{
                    str_replace_editor: {
                        type: "provider-defined";
                        id: "anthropic.text_editor_20250124";
                        args: {};
                        parameters: import("zod").ZodObject<{
                            command: import("zod").ZodEnum<["view", "create", "str_replace", "insert", "undo_edit"]>;
                            path: import("zod").ZodString;
                            file_text: import("zod").ZodOptional<import("zod").ZodString>;
                            insert_line: import("zod").ZodOptional<import("zod").ZodNumber>;
                            new_str: import("zod").ZodOptional<import("zod").ZodString>;
                            old_str: import("zod").ZodOptional<import("zod").ZodString>;
                            view_range: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodNumber, "many">>;
                        }, "strip", import("zod").ZodTypeAny, {
                            path: string;
                            command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                            file_text?: string | undefined;
                            insert_line?: number | undefined;
                            new_str?: string | undefined;
                            old_str?: string | undefined;
                            view_range?: number[] | undefined;
                        }, {
                            path: string;
                            command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                            file_text?: string | undefined;
                            insert_line?: number | undefined;
                            new_str?: string | undefined;
                            old_str?: string | undefined;
                            view_range?: number[] | undefined;
                        }>;
                        execute: ((args: {
                            path: string;
                            command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                            file_text?: string | undefined;
                            insert_line?: number | undefined;
                            new_str?: string | undefined;
                            old_str?: string | undefined;
                            view_range?: number[] | undefined;
                        }, options: {
                            abortSignal?: AbortSignal;
                        }) => Promise<unknown>) | undefined;
                        experimental_toToolResultContent?: ((result: unknown) => ({
                            type: "text";
                            text: string;
                        } | {
                            type: "image";
                            data: string;
                            mimeType?: string;
                        })[]) | undefined;
                    } | (import("ai").Tool<import("zod").ZodObject<{
                        command: import("zod").ZodEnum<["view", "create", "str_replace", "insert", "undo_edit"]>;
                        path: import("zod").ZodString;
                        file_text: import("zod").ZodNullable<import("zod").ZodString>;
                        insert_line: import("zod").ZodNullable<import("zod").ZodNumber>;
                        new_str: import("zod").ZodNullable<import("zod").ZodString>;
                        old_str: import("zod").ZodNullable<import("zod").ZodString>;
                        view_range: import("zod").ZodNullable<import("zod").ZodArray<import("zod").ZodNumber, "many">>;
                    }, "strip", import("zod").ZodTypeAny, {
                        path: string;
                        command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                        file_text: string | null;
                        insert_line: number | null;
                        new_str: string | null;
                        old_str: string | null;
                        view_range: number[] | null;
                    }, {
                        path: string;
                        command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                        file_text: string | null;
                        insert_line: number | null;
                        new_str: string | null;
                        old_str: string | null;
                        view_range: number[] | null;
                    }>, string | {
                        success: boolean;
                        error: any;
                        message?: undefined;
                        content?: undefined;
                    } | {
                        success: boolean;
                        message: string;
                        content: string;
                        error?: undefined;
                    }> & {
                        execute: (args: {
                            path: string;
                            command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                            file_text: string | null;
                            insert_line: number | null;
                            new_str: string | null;
                            old_str: string | null;
                            view_range: number[] | null;
                        }, options: import("ai").ToolExecutionOptions) => PromiseLike<string | {
                            success: boolean;
                            error: any;
                            message?: undefined;
                            content?: undefined;
                        } | {
                            success: boolean;
                            message: string;
                            content: string;
                            error?: undefined;
                        }>;
                    });
                    get_project_files: import("ai").Tool<import("zod").ZodObject<{}, "strip", import("zod").ZodTypeAny, {}, {}>, string> & {
                        execute: (args: {}, options: import("ai").ToolExecutionOptions) => PromiseLike<string>;
                    };
                    render_form: import("ai").Tool<import("zod").ZodObject<{
                        fields: import("zod").ZodArray<import("zod").ZodObject<{
                            name: import("zod").ZodString;
                            type: import("zod").ZodEnum<["input", "password", "textarea", "number", "select", "slider", "switch", "color_picker", "date_picker", "image_upload", "button"]>;
                            label: import("zod").ZodString;
                            description: import("zod").ZodNullable<import("zod").ZodString>;
                            required: import("zod").ZodNullable<import("zod").ZodBoolean>;
                            placeholder: import("zod").ZodNullable<import("zod").ZodString>;
                            initialValue: import("zod").ZodUnion<[import("zod").ZodNullable<import("zod").ZodString>, import("zod").ZodNullable<import("zod").ZodNumber>, import("zod").ZodNullable<import("zod").ZodBoolean>]>;
                            min: import("zod").ZodNullable<import("zod").ZodNumber>;
                            max: import("zod").ZodNullable<import("zod").ZodNumber>;
                            step: import("zod").ZodNullable<import("zod").ZodNumber>;
                            options: import("zod").ZodNullable<import("zod").ZodArray<import("zod").ZodObject<{
                                label: import("zod").ZodString;
                                value: import("zod").ZodString;
                            }, "strip", import("zod").ZodTypeAny, {
                                label: string;
                                value: string;
                            }, {
                                label: string;
                                value: string;
                            }>, "many">>;
                            href: import("zod").ZodNullable<import("zod").ZodString>;
                        }, "strip", import("zod").ZodTypeAny, {
                            name: string;
                            href: string | null;
                            type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                            label: string;
                            max: number | null;
                            min: number | null;
                            placeholder: string | null;
                            required: boolean | null;
                            step: number | null;
                            description: string | null;
                            options: {
                                label: string;
                                value: string;
                            }[] | null;
                            initialValue: string | number | boolean | null;
                        }, {
                            name: string;
                            href: string | null;
                            type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                            label: string;
                            max: number | null;
                            min: number | null;
                            placeholder: string | null;
                            required: boolean | null;
                            step: number | null;
                            description: string | null;
                            options: {
                                label: string;
                                value: string;
                            }[] | null;
                            initialValue: string | number | boolean | null;
                        }>, "many">;
                    }, "strip", import("zod").ZodTypeAny, {
                        fields: {
                            name: string;
                            href: string | null;
                            type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                            label: string;
                            max: number | null;
                            min: number | null;
                            placeholder: string | null;
                            required: boolean | null;
                            step: number | null;
                            description: string | null;
                            options: {
                                label: string;
                                value: string;
                            }[] | null;
                            initialValue: string | number | boolean | null;
                        }[];
                    }, {
                        fields: {
                            name: string;
                            href: string | null;
                            type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                            label: string;
                            max: number | null;
                            min: number | null;
                            placeholder: string | null;
                            required: boolean | null;
                            step: number | null;
                            description: string | null;
                            options: {
                                label: string;
                                value: string;
                            }[] | null;
                            initialValue: string | number | boolean | null;
                        }[];
                    }>, "rendered form to the user" | {
                        errors: string[];
                    }> & {
                        execute: (args: {
                            fields: {
                                name: string;
                                href: string | null;
                                type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                                label: string;
                                max: number | null;
                                min: number | null;
                                placeholder: string | null;
                                required: boolean | null;
                                step: number | null;
                                description: string | null;
                                options: {
                                    label: string;
                                    value: string;
                                }[] | null;
                                initialValue: string | number | boolean | null;
                            }[];
                        }, options: import("ai").ToolExecutionOptions) => PromiseLike<"rendered form to the user" | {
                            errors: string[];
                        }>;
                    };
                }>, void, unknown>;
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
                orgId: string;
                branchId: string;
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
                url: string;
                message: string;
                branchId: string;
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
                filesInDraft: Record<string, {
                    content: string;
                    githubPath: string;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                } | null>;
                branchId: string;
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
                chatId: string;
                filesInDraft: Record<string, {
                    content: string;
                    githubPath: string;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                } | null>;
                branchId: string;
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
        createSiteFromFiles: {
            post: (request: {
                orgId: string;
                name: string;
                files: {
                    contents: string;
                    relativePath: string;
                }[];
                githubBranch?: string | undefined;
                githubOwner?: string | undefined;
                githubRepo?: string | undefined;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    siteId: any;
                    branchId: any;
                    docsJson: string | number | true | import("@prisma/client/runtime/client").JsonObject | import("@prisma/client/runtime/client").JsonArray;
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
                    files: {
                        contents: string;
                        relativePath: string;
                    }[];
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
                githubPath: string;
                branchId: string;
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
                siteId: string;
                chatId: string;
                messages: import("ai").UIMessage[];
                filesInDraft: Record<string, {
                    content: string;
                    githubPath: string;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                } | null>;
                currentSlug: string;
                branchId: string;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: AsyncGenerator<import("ai").TextStreamPart<{
                    str_replace_editor: {
                        type: "provider-defined";
                        id: "anthropic.text_editor_20250124";
                        args: {};
                        parameters: import("zod").ZodObject<{
                            command: import("zod").ZodEnum<["view", "create", "str_replace", "insert", "undo_edit"]>;
                            path: import("zod").ZodString;
                            file_text: import("zod").ZodOptional<import("zod").ZodString>;
                            insert_line: import("zod").ZodOptional<import("zod").ZodNumber>;
                            new_str: import("zod").ZodOptional<import("zod").ZodString>;
                            old_str: import("zod").ZodOptional<import("zod").ZodString>;
                            view_range: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodNumber, "many">>;
                        }, "strip", import("zod").ZodTypeAny, {
                            path: string;
                            command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                            file_text?: string | undefined;
                            insert_line?: number | undefined;
                            new_str?: string | undefined;
                            old_str?: string | undefined;
                            view_range?: number[] | undefined;
                        }, {
                            path: string;
                            command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                            file_text?: string | undefined;
                            insert_line?: number | undefined;
                            new_str?: string | undefined;
                            old_str?: string | undefined;
                            view_range?: number[] | undefined;
                        }>;
                        execute: ((args: {
                            path: string;
                            command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                            file_text?: string | undefined;
                            insert_line?: number | undefined;
                            new_str?: string | undefined;
                            old_str?: string | undefined;
                            view_range?: number[] | undefined;
                        }, options: {
                            abortSignal?: AbortSignal;
                        }) => Promise<unknown>) | undefined;
                        experimental_toToolResultContent?: ((result: unknown) => ({
                            type: "text";
                            text: string;
                        } | {
                            type: "image";
                            data: string;
                            mimeType?: string;
                        })[]) | undefined;
                    } | (import("ai").Tool<import("zod").ZodObject<{
                        command: import("zod").ZodEnum<["view", "create", "str_replace", "insert", "undo_edit"]>;
                        path: import("zod").ZodString;
                        file_text: import("zod").ZodNullable<import("zod").ZodString>;
                        insert_line: import("zod").ZodNullable<import("zod").ZodNumber>;
                        new_str: import("zod").ZodNullable<import("zod").ZodString>;
                        old_str: import("zod").ZodNullable<import("zod").ZodString>;
                        view_range: import("zod").ZodNullable<import("zod").ZodArray<import("zod").ZodNumber, "many">>;
                    }, "strip", import("zod").ZodTypeAny, {
                        path: string;
                        command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                        file_text: string | null;
                        insert_line: number | null;
                        new_str: string | null;
                        old_str: string | null;
                        view_range: number[] | null;
                    }, {
                        path: string;
                        command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                        file_text: string | null;
                        insert_line: number | null;
                        new_str: string | null;
                        old_str: string | null;
                        view_range: number[] | null;
                    }>, string | {
                        success: boolean;
                        error: any;
                        message?: undefined;
                        content?: undefined;
                    } | {
                        success: boolean;
                        message: string;
                        content: string;
                        error?: undefined;
                    }> & {
                        execute: (args: {
                            path: string;
                            command: "view" | "create" | "str_replace" | "insert" | "undo_edit";
                            file_text: string | null;
                            insert_line: number | null;
                            new_str: string | null;
                            old_str: string | null;
                            view_range: number[] | null;
                        }, options: import("ai").ToolExecutionOptions) => PromiseLike<string | {
                            success: boolean;
                            error: any;
                            message?: undefined;
                            content?: undefined;
                        } | {
                            success: boolean;
                            message: string;
                            content: string;
                            error?: undefined;
                        }>;
                    });
                    get_project_files: import("ai").Tool<import("zod").ZodObject<{}, "strip", import("zod").ZodTypeAny, {}, {}>, string> & {
                        execute: (args: {}, options: import("ai").ToolExecutionOptions) => PromiseLike<string>;
                    };
                    render_form: import("ai").Tool<import("zod").ZodObject<{
                        fields: import("zod").ZodArray<import("zod").ZodObject<{
                            name: import("zod").ZodString;
                            type: import("zod").ZodEnum<["input", "password", "textarea", "number", "select", "slider", "switch", "color_picker", "date_picker", "image_upload", "button"]>;
                            label: import("zod").ZodString;
                            description: import("zod").ZodNullable<import("zod").ZodString>;
                            required: import("zod").ZodNullable<import("zod").ZodBoolean>;
                            placeholder: import("zod").ZodNullable<import("zod").ZodString>;
                            initialValue: import("zod").ZodUnion<[import("zod").ZodNullable<import("zod").ZodString>, import("zod").ZodNullable<import("zod").ZodNumber>, import("zod").ZodNullable<import("zod").ZodBoolean>]>;
                            min: import("zod").ZodNullable<import("zod").ZodNumber>;
                            max: import("zod").ZodNullable<import("zod").ZodNumber>;
                            step: import("zod").ZodNullable<import("zod").ZodNumber>;
                            options: import("zod").ZodNullable<import("zod").ZodArray<import("zod").ZodObject<{
                                label: import("zod").ZodString;
                                value: import("zod").ZodString;
                            }, "strip", import("zod").ZodTypeAny, {
                                label: string;
                                value: string;
                            }, {
                                label: string;
                                value: string;
                            }>, "many">>;
                            href: import("zod").ZodNullable<import("zod").ZodString>;
                        }, "strip", import("zod").ZodTypeAny, {
                            name: string;
                            href: string | null;
                            type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                            label: string;
                            max: number | null;
                            min: number | null;
                            placeholder: string | null;
                            required: boolean | null;
                            step: number | null;
                            description: string | null;
                            options: {
                                label: string;
                                value: string;
                            }[] | null;
                            initialValue: string | number | boolean | null;
                        }, {
                            name: string;
                            href: string | null;
                            type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                            label: string;
                            max: number | null;
                            min: number | null;
                            placeholder: string | null;
                            required: boolean | null;
                            step: number | null;
                            description: string | null;
                            options: {
                                label: string;
                                value: string;
                            }[] | null;
                            initialValue: string | number | boolean | null;
                        }>, "many">;
                    }, "strip", import("zod").ZodTypeAny, {
                        fields: {
                            name: string;
                            href: string | null;
                            type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                            label: string;
                            max: number | null;
                            min: number | null;
                            placeholder: string | null;
                            required: boolean | null;
                            step: number | null;
                            description: string | null;
                            options: {
                                label: string;
                                value: string;
                            }[] | null;
                            initialValue: string | number | boolean | null;
                        }[];
                    }, {
                        fields: {
                            name: string;
                            href: string | null;
                            type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                            label: string;
                            max: number | null;
                            min: number | null;
                            placeholder: string | null;
                            required: boolean | null;
                            step: number | null;
                            description: string | null;
                            options: {
                                label: string;
                                value: string;
                            }[] | null;
                            initialValue: string | number | boolean | null;
                        }[];
                    }>, "rendered form to the user" | {
                        errors: string[];
                    }> & {
                        execute: (args: {
                            fields: {
                                name: string;
                                href: string | null;
                                type: "number" | "input" | "button" | "select" | "textarea" | "switch" | "slider" | "password" | "color_picker" | "date_picker" | "image_upload";
                                label: string;
                                max: number | null;
                                min: number | null;
                                placeholder: string | null;
                                required: boolean | null;
                                step: number | null;
                                description: string | null;
                                options: {
                                    label: string;
                                    value: string;
                                }[] | null;
                                initialValue: string | number | boolean | null;
                            }[];
                        }, options: import("ai").ToolExecutionOptions) => PromiseLike<"rendered form to the user" | {
                            errors: string[];
                        }>;
                    };
                }>, void, unknown>;
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
                orgId: string;
                branchId: string;
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
                url: string;
                message: string;
                branchId: string;
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
                filesInDraft: Record<string, {
                    content: string;
                    githubPath: string;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                } | null>;
                branchId: string;
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
                chatId: string;
                filesInDraft: Record<string, {
                    content: string;
                    githubPath: string;
                    addedLines?: number | undefined;
                    deletedLines?: number | undefined;
                } | null>;
                branchId: string;
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
        createSiteFromFiles: {
            post: (request: {
                orgId: string;
                name: string;
                files: {
                    contents: string;
                    relativePath: string;
                }[];
                githubBranch?: string | undefined;
                githubOwner?: string | undefined;
                githubRepo?: string | undefined;
            }, options?: {
                headers?: Record<string, unknown> | undefined;
                query?: Record<string, unknown> | undefined;
                fetch?: RequestInit | undefined;
            } | undefined) => Promise<import("spiceflow/client").SpiceflowClient.ClientResponse<{
                200: {
                    success: boolean;
                    siteId: any;
                    branchId: any;
                    docsJson: string | number | true | import("@prisma/client/runtime/client").JsonObject | import("@prisma/client/runtime/client").JsonArray;
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
                    files: {
                        contents: string;
                        relativePath: string;
                    }[];
                };
            }>>;
        };
    };
};
