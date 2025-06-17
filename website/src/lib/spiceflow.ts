import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import dedent from 'string-dedent'

import { anthropic } from '@ai-sdk/anthropic'
import { streamText, tool, UIMessage } from 'ai'
import { prisma } from 'db'
import { s3 } from 'docs-website/src/lib/s3'
import { Spiceflow } from 'spiceflow'
import { openapi } from 'spiceflow/openapi'
import { z } from 'zod'
import { getSession } from './better-auth'
import { env } from './env'
import { notifyError } from './errors'
import { pagesFromGithub, syncSite } from './sync'
import { sleep } from './utils'

import { printDirectoryTree } from '../components/directory-tree'
import {
    createEditExecute,
    editToolParamsSchema,
    PageUpdate,
} from './edit-tool'

// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow({ basePath: '/api' })
    // .state('env', {} as Env)
    // Health check endpoint
    .use(openapi())
    .route({
        method: 'GET',
        path: '/health',
        handler() {
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
            }
        },
    })
    .route({
        method: 'POST',
        path: '/generateMessage',
        request: z.object({
            messages: z.array(z.custom<UIMessage>()),
            siteId: z.string(),
            tabId: z.string(),
        }),
        async *handler({ request }) {
            const { messages, tabId, siteId } = await request.json()
            await sleep(1000)
            const updatedPages: Record<string, PageUpdate> = {}
            const model = openai.responses('gpt-4.1')
            const execute = createEditExecute({
                updatedPages,
                async getPageContent({ githubPath: path }) {
                    const page = await prisma.markdownPage.findFirst({
                        where: {
                            githubPath: path,
                        },
                    })
                    if (!page) {
                        throw new Error(`Cannot find page with path ${path}`)
                    }
                    return page.markdown || ''
                },
            })
            const [pages, metaFiles, mediaAssets] = await Promise.all([
                prisma.markdownPage.findMany({
                    where: {
                        tabId,
                    },
                    omit: {
                        markdown: true,
                        structuredData: true,
                    },
                }),
                prisma.metaFile.findMany({
                    where: {
                        tabId,
                    },
                    omit: {
                        jsonData: true,
                    },
                }),
                prisma.mediaAsset.findMany({
                    where: {
                        tabId,
                    },
                }),
            ])
            const allFiles = [
                ...pages.map((x) => ({ ...x, type: 'page' }) as const),
                ...metaFiles.map((x) => ({ ...x, type: 'meta' }) as const),
                ...mediaAssets.map((x) => ({ ...x, type: 'media' }) as const),
            ].flat()

            const str_replace_editor = model.modelId.includes('anthropic')
                ? anthropic.tools.textEditor_20241022({
                      execute: execute as any,
                  })
                : tool({
                      parameters: editToolParamsSchema,
                      execute,
                  })

            const result = streamText({
                model,
                messages: [
                    {
                        role: 'system',
                        content: dedent`
                        This is a documentation website using .md and .mdx files

                        You are a professional content writer with the task of improving this documentation website and follow the user tasks
                        `,
                    },
                    ...messages.filter((x) => x.role !== 'system'),
                ],
                maxSteps: 100,

                experimental_providerMetadata: {
                    openai: {
                        reasoningSummary: 'detailed',
                    } satisfies OpenAIResponsesProviderOptions,
                },
                toolCallStreaming: true,
                tools: {
                    str_replace_editor,

                    get_project_files: tool({
                        description:
                            'Returns a directory tree diagram of the current project files as plain text. Useful for giving an overview or locating files.',
                        parameters: z.object({}),
                        execute: async () => {
                            return printDirectoryTree({
                                filePaths: allFiles.map((x) => {
                                    const path = x.githubPath
                                    let title = ''
                                    if (x.type === 'page') {
                                        title = x.title
                                    }
                                    return { path, title }
                                }),
                            })
                        },
                    }),
                },
                async onFinish({ response }) {},
                // tools: {
                //   some: tool({
                //     description: "A sample tool",
                //     parameters: z.object({ hello: z.string() }),

                //     execute: async (args, {}) => {
                //       args.hello;
                //       return "Tool executed";
                //     },
                //   }),
                // },
            })

            for await (const part of result.fullStream) {
                if ('request' in part) {
                    part.request = null as any
                }
                if ('response' in part) {
                    part.response = null as any
                }
                console.log(part)
                yield part
            }
        },
    })
    .route({
        method: 'POST',
        path: '/githubSync',
        request: z.object({
            siteId: z.string().min(1, 'siteId is required'),
            // tabId: z.string().min(1, 'tabId is required'),
        }),
        async handler({ request, state }) {
            const { userId } = await getSession({ request })
            const { siteId } = await request.json()

            if (!userId) {
                throw new Error('Missing x-user-id header')
            }
            const site = await prisma.site.findFirst({
                where: { siteId, org: { users: { some: { userId } } } },
                include: { tabs: true },
            })

            if (!site) {
                throw new Error('Site not found for this user')
            }
            const tab = site.tabs.find((x) => x)
            if (!tab) {
                throw new Error('Tab not found for this site')
            }
            const tabId = tab.tabId
            const orgId = site.orgId
            const name = site.name
            const pages = pagesFromGithub({
                installationId: site.installationId,
                owner: site.githubOwner,
                repo: site.githubRepo,
                signal: request.signal,
                tabId,
                // forceFullSync: true,
            })
            await syncSite({
                orgId,
                siteId,
                tabId,
                name: site.name || '',
                trieveDatasetId: site.trieveDatasetId || undefined,
                pages,
            })
            // Implement your sync logic here
            // For now, just echo back the input
            return {
                success: true,
                siteId,
                tabId,
                message: 'Sync route called successfully',
            }
        },
    })
    // .route({
    //     method: 'POST',
    //     path: '/upload/*',

    //     async handler({ request, params: { '*': key }, state }) {
    //         const bucket = state.env.UPLOADS_BUCKET
    //         // TODO check that user can do this
    //         await bucket.put(key, request.body as any, {
    //             httpMetadata: request.headers as any,
    //         })
    //         return null
    //     },
    // })
    // .route({
    //     method: 'POST',
    //     path: '/createUploadSignedUrl',
    //     request: z.object({
    //         key: z.string().min(1, 'Key is required'),
    //         contentType: z.string().optional(),
    //     }),
    //     async handler({ request, state }) {
    //         const body = await request.json()

    //         // const signedUrl = s3.presign(body.key, {
    //         //     method: 'PUT',
    //         // })
    //         const signedUrl = this.safePath('/api/upload/*', { '*': body.key })
    //         const finalUrl = new URL(body.key, env.UPLOADS_BASE_URL).toString()

    //         return {
    //             success: true,
    //             path: body.key,
    //             signedUrl,
    //             finalUrl,
    //         }
    //     },
    // })
    .route({
        method: 'POST',
        path: '/createUploadSignedUrl',
        request: z.object({
            key: z.string().min(1, 'Key is required'),
            contentType: z.string().optional(),
        }),
        async handler({ request, state }) {
            const body = await request.json()

            const signedUrl = s3.presign(body.key, {
                method: 'PUT',
            })

            const finalUrl = new URL(body.key, env.UPLOADS_BASE_URL).toString()

            return {
                success: true,
                path: body.key,
                signedUrl,
                finalUrl,
            }
        },
    })

    .onError(({ error }) => {
        notifyError(error)
    })

export type SpiceflowApp = typeof app
