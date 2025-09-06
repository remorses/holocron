import { createSpiceflowClient } from 'spiceflow/client'
import { DurableFetchClient } from 'durablefetch'
export declare const apiClient: {
  api: {
    openapi: {
      get: (
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          [x: number]: any
          200: any
        }>
      >
    }
    health: {
      get: (
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            status: string
            timestamp: string
            uptime: number
          }
        }>
      >
    }
    getPageContent: {
      post: (
        request: {
          branchId: string
          githubPath: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            content: string | undefined
          }
        }>
      >
    }
    generateMessage: {
      post: (
        request: {
          messages: import('./types').WebsiteUIMessage[]
          siteId: string
          chatId: string
          branchId: string
          githubFolder: string
          currentSlug: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: AsyncGenerator<import('ai').InferUIMessageChunk<import('./types').WebsiteUIMessage>, void, unknown>
        }>
      >
    }
    githubSync: {
      post: (
        request: {
          siteId: string
          githubBranch: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            siteId: string
            branchId: string
            githubBranch: string
            message: string
          }
        }>
      >
    }
    createUploadSignedUrl: {
      post: (
        request: {
          siteId: string
          files: {
            slug: string
            contentLength: number
            contentType?: string | undefined
          }[]
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            files: {
              path: string
              signedUrl: string
              finalUrl: string
            }[]
          }
        }>
      >
    }
    newChat: {
      post: (
        request: {
          branchId: string
          orgId: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            chatId: string
          }
        }>
      >
    }
    submitRateFeedback: {
      post: (
        request: {
          branchId: string
          url: string
          opinion: 'good' | 'bad'
          message: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            githubUrl: string
          }
        }>
      >
    }
    commitChangesToRepo: {
      post: (
        request: {
          branchId: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            prUrl: string
            commitUrl: string
            githubAuthUrl: string
          }
        }>
      >
    }
    updateChatFilesInDraft: {
      post: (
        request: {
          chatId: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
          }
        }>
      >
    }
    saveChangesForChat: {
      post: (
        request: {
          branchId: string
          chatId: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
          }
        }>
      >
    }
    getCliSession: {
      post: (
        request: {
          secret: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200:
            | {
                apiKey?: undefined
                userId?: undefined
                userEmail?: undefined
                orgs?: undefined
              }
            | {
                apiKey: string
                userId: string
                userEmail: string
                orgs: {
                  orgId: string
                  name: string
                }[]
              }
        }>
      >
    }
    upsertSiteFromFiles: {
      post: (
        request: {
          name: string
          files: {
            relativePath: string
            contents: string
            downloadUrl?: string | undefined
            metadata?:
              | {
                  width?: number | undefined
                  height?: number | undefined
                }
              | undefined
          }[]
          orgId: string
          githubOwner?: string | undefined
          githubRepo?: string | undefined
          githubRepoId?: number | undefined
          githubBranch?: string | undefined
          githubFolder?: string | undefined
          siteId?: string | undefined
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            docsJsonWithComments: string
            siteId: string
            branchId: string
            docsJson: import('docs-website/src/lib/docs-json').DocsJsonType
            errors: {
              githubPath: string
              line: number
              errorMessage: string
              errorType: import('db/src/generated/enums').MarkdownPageSyncErrorType
            }[]
            orgId?: string | undefined
            name?: string | null | undefined
            createdAt?: Date | undefined
            githubOwner?: string | null | undefined
            githubRepo?: string | null | undefined
            githubFolder?: string | undefined
            defaultLocale?: string | undefined
            githubRepoId?: number | undefined
          }
        }>
      >
    }
    getStarterTemplate: {
      get: (
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            files: (
              | {
                  content: string
                  filePath: string
                  encoding?: undefined
                }
              | {
                  content: string
                  filePath: string
                  encoding: string
                }
            )[]
          }
        }>
      >
    }
    transcribeAudio: {
      post: (
        request?: unknown,
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            text: string
          }
        }>
      >
    }
    getRepoBranches: {
      post: (
        request: {
          orgId: string
          owner: string
          repo: string
          installationId: number
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            branches: {
              name: string
              isDefault: boolean
            }[]
            defaultBranch: string
          }
        }>
      >
    }
    deleteWebsite: {
      post: (
        request: {
          siteId: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            message: string
            siteId: string
          }
        }>
      >
    }
    databaseNightlyCleanup: {
      post: (
        request: {
          SERVICE_SECRET: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            message: string
            deletedCount: number
          }
        }>
      >
    }
  }
}
export declare function createApiClient(
  url: string,
  options?: Parameters<typeof createSpiceflowClient>[1],
): {
  api: {
    openapi: {
      get: (
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          [x: number]: any
          200: any
        }>
      >
    }
    health: {
      get: (
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            status: string
            timestamp: string
            uptime: number
          }
        }>
      >
    }
    getPageContent: {
      post: (
        request: {
          branchId: string
          githubPath: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            content: string | undefined
          }
        }>
      >
    }
    generateMessage: {
      post: (
        request: {
          messages: import('./types').WebsiteUIMessage[]
          siteId: string
          chatId: string
          branchId: string
          githubFolder: string
          currentSlug: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: AsyncGenerator<import('ai').InferUIMessageChunk<import('./types').WebsiteUIMessage>, void, unknown>
        }>
      >
    }
    githubSync: {
      post: (
        request: {
          siteId: string
          githubBranch: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            siteId: string
            branchId: string
            githubBranch: string
            message: string
          }
        }>
      >
    }
    createUploadSignedUrl: {
      post: (
        request: {
          siteId: string
          files: {
            slug: string
            contentLength: number
            contentType?: string | undefined
          }[]
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            files: {
              path: string
              signedUrl: string
              finalUrl: string
            }[]
          }
        }>
      >
    }
    newChat: {
      post: (
        request: {
          branchId: string
          orgId: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            chatId: string
          }
        }>
      >
    }
    submitRateFeedback: {
      post: (
        request: {
          branchId: string
          url: string
          opinion: 'good' | 'bad'
          message: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            githubUrl: string
          }
        }>
      >
    }
    commitChangesToRepo: {
      post: (
        request: {
          branchId: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            prUrl: string
            commitUrl: string
            githubAuthUrl: string
          }
        }>
      >
    }
    updateChatFilesInDraft: {
      post: (
        request: {
          chatId: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
          }
        }>
      >
    }
    saveChangesForChat: {
      post: (
        request: {
          branchId: string
          chatId: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
          }
        }>
      >
    }
    getCliSession: {
      post: (
        request: {
          secret: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200:
            | {
                apiKey?: undefined
                userId?: undefined
                userEmail?: undefined
                orgs?: undefined
              }
            | {
                apiKey: string
                userId: string
                userEmail: string
                orgs: {
                  orgId: string
                  name: string
                }[]
              }
        }>
      >
    }
    upsertSiteFromFiles: {
      post: (
        request: {
          name: string
          files: {
            relativePath: string
            contents: string
            downloadUrl?: string | undefined
            metadata?:
              | {
                  width?: number | undefined
                  height?: number | undefined
                }
              | undefined
          }[]
          orgId: string
          githubOwner?: string | undefined
          githubRepo?: string | undefined
          githubRepoId?: number | undefined
          githubBranch?: string | undefined
          githubFolder?: string | undefined
          siteId?: string | undefined
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            docsJsonWithComments: string
            siteId: string
            branchId: string
            docsJson: import('docs-website/src/lib/docs-json').DocsJsonType
            errors: {
              githubPath: string
              line: number
              errorMessage: string
              errorType: import('db/src/generated/enums').MarkdownPageSyncErrorType
            }[]
            orgId?: string | undefined
            name?: string | null | undefined
            createdAt?: Date | undefined
            githubOwner?: string | null | undefined
            githubRepo?: string | null | undefined
            githubFolder?: string | undefined
            defaultLocale?: string | undefined
            githubRepoId?: number | undefined
          }
        }>
      >
    }
    getStarterTemplate: {
      get: (
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            files: (
              | {
                  content: string
                  filePath: string
                  encoding?: undefined
                }
              | {
                  content: string
                  filePath: string
                  encoding: string
                }
            )[]
          }
        }>
      >
    }
    transcribeAudio: {
      post: (
        request?: unknown,
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            text: string
          }
        }>
      >
    }
    getRepoBranches: {
      post: (
        request: {
          orgId: string
          owner: string
          repo: string
          installationId: number
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            branches: {
              name: string
              isDefault: boolean
            }[]
            defaultBranch: string
          }
        }>
      >
    }
    deleteWebsite: {
      post: (
        request: {
          siteId: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            message: string
            siteId: string
          }
        }>
      >
    }
    databaseNightlyCleanup: {
      post: (
        request: {
          SERVICE_SECRET: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            message: string
            deletedCount: number
          }
        }>
      >
    }
  }
}
export declare const durableFetchClient: DurableFetchClient
export declare const apiClientWithDurableFetch: {
  api: {
    openapi: {
      get: (
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          [x: number]: any
          200: any
        }>
      >
    }
    health: {
      get: (
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            status: string
            timestamp: string
            uptime: number
          }
        }>
      >
    }
    getPageContent: {
      post: (
        request: {
          branchId: string
          githubPath: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            content: string | undefined
          }
        }>
      >
    }
    generateMessage: {
      post: (
        request: {
          messages: import('./types').WebsiteUIMessage[]
          siteId: string
          chatId: string
          branchId: string
          githubFolder: string
          currentSlug: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: AsyncGenerator<import('ai').InferUIMessageChunk<import('./types').WebsiteUIMessage>, void, unknown>
        }>
      >
    }
    githubSync: {
      post: (
        request: {
          siteId: string
          githubBranch: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            siteId: string
            branchId: string
            githubBranch: string
            message: string
          }
        }>
      >
    }
    createUploadSignedUrl: {
      post: (
        request: {
          siteId: string
          files: {
            slug: string
            contentLength: number
            contentType?: string | undefined
          }[]
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            files: {
              path: string
              signedUrl: string
              finalUrl: string
            }[]
          }
        }>
      >
    }
    newChat: {
      post: (
        request: {
          branchId: string
          orgId: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            chatId: string
          }
        }>
      >
    }
    submitRateFeedback: {
      post: (
        request: {
          branchId: string
          url: string
          opinion: 'good' | 'bad'
          message: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            githubUrl: string
          }
        }>
      >
    }
    commitChangesToRepo: {
      post: (
        request: {
          branchId: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            prUrl: string
            commitUrl: string
            githubAuthUrl: string
          }
        }>
      >
    }
    updateChatFilesInDraft: {
      post: (
        request: {
          chatId: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
          }
        }>
      >
    }
    saveChangesForChat: {
      post: (
        request: {
          branchId: string
          chatId: string
          filesInDraft: Record<
            string,
            {
              githubPath: string
              content: string | null
              addedLines?: number | undefined
              deletedLines?: number | undefined
            }
          >
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
          }
        }>
      >
    }
    getCliSession: {
      post: (
        request: {
          secret: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200:
            | {
                apiKey?: undefined
                userId?: undefined
                userEmail?: undefined
                orgs?: undefined
              }
            | {
                apiKey: string
                userId: string
                userEmail: string
                orgs: {
                  orgId: string
                  name: string
                }[]
              }
        }>
      >
    }
    upsertSiteFromFiles: {
      post: (
        request: {
          name: string
          files: {
            relativePath: string
            contents: string
            downloadUrl?: string | undefined
            metadata?:
              | {
                  width?: number | undefined
                  height?: number | undefined
                }
              | undefined
          }[]
          orgId: string
          githubOwner?: string | undefined
          githubRepo?: string | undefined
          githubRepoId?: number | undefined
          githubBranch?: string | undefined
          githubFolder?: string | undefined
          siteId?: string | undefined
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            docsJsonWithComments: string
            siteId: string
            branchId: string
            docsJson: import('docs-website/src/lib/docs-json').DocsJsonType
            errors: {
              githubPath: string
              line: number
              errorMessage: string
              errorType: import('db/src/generated/enums').MarkdownPageSyncErrorType
            }[]
            orgId?: string | undefined
            name?: string | null | undefined
            createdAt?: Date | undefined
            githubOwner?: string | null | undefined
            githubRepo?: string | null | undefined
            githubFolder?: string | undefined
            defaultLocale?: string | undefined
            githubRepoId?: number | undefined
          }
        }>
      >
    }
    getStarterTemplate: {
      get: (
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            files: (
              | {
                  content: string
                  filePath: string
                  encoding?: undefined
                }
              | {
                  content: string
                  filePath: string
                  encoding: string
                }
            )[]
          }
        }>
      >
    }
    transcribeAudio: {
      post: (
        request?: unknown,
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            text: string
          }
        }>
      >
    }
    getRepoBranches: {
      post: (
        request: {
          orgId: string
          owner: string
          repo: string
          installationId: number
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            branches: {
              name: string
              isDefault: boolean
            }[]
            defaultBranch: string
          }
        }>
      >
    }
    deleteWebsite: {
      post: (
        request: {
          siteId: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            message: string
            siteId: string
          }
        }>
      >
    }
    databaseNightlyCleanup: {
      post: (
        request: {
          SERVICE_SECRET: string
        },
        options?:
          | {
              headers?: Record<string, unknown> | undefined
              query?: Record<string, unknown> | undefined
              fetch?: RequestInit | undefined
            }
          | undefined,
      ) => Promise<
        import('spiceflow/client').SpiceflowClient.ClientResponse<{
          200: {
            success: boolean
            message: string
            deletedCount: number
          }
        }>
      >
    }
  }
}
