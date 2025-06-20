import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai'

import dedent from 'string-dedent'

import { anthropic } from '@ai-sdk/anthropic'
import { appendResponseMessages, streamText, tool, UIMessage } from 'ai'
import { prisma } from 'db'
import { s3 } from 'docs-website/src/lib/s3'
import { Spiceflow } from 'spiceflow'
import { openapi } from 'spiceflow/openapi'
import { z } from 'zod'
import { getSession } from './better-auth'
import { env } from './env'
import { notifyError } from './errors'
import { pagesFromGithub, syncSite } from './sync'
import { mdxRegex, sleep } from './utils'

import { printDirectoryTree } from '../components/directory-tree'
import {
    createEditExecute,
    editToolParamsSchema,
    PageUpdate,
} from './edit-tool'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import path from 'path'

// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow({ basePath: '/api' })
    // .state('env', {} as Env)
    // Health check endpoint
    .state('userId', '')
    .use(async ({ request, state }) => {
        const session = await getSession({ request })
        state.userId = session?.userId
    })
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
        path: '/getPageContent',
        request: z.object({
            tabId: z.string(),
            githubPath: z.string(),
        }),
        async handler({ request, state: { userId } }) {
            let { tabId, githubPath } = await request.json()
            // Remove leading slash from githubPath, if present
            if (githubPath.startsWith('/')) {
                githubPath = githubPath.slice(1)
            }
            // First, check if the user can access the requested tab
            const tab = await prisma.tab.findFirst({
                where: {
                    tabId,
                    site: {
                        org: {
                            users: {
                                some: {
                                    userId,
                                },
                            },
                        },
                    },
                },
            })
            if (!tab) {
                throw new Error('You do not have access to this tab')
            }

            const [page, metaFile] = await Promise.all([
                prisma.markdownPage.findFirst({
                    where: {
                        tabId,
                        githubPath,
                    },
                }),
                prisma.metaFile.findFirst({
                    where: {
                        tabId,
                        githubPath,
                    },
                }),
            ])
            if (!page && !metaFile) {
                throw new Error(`Cannot find page in ${githubPath}`)
            }
            return {
                success: true,
                content:
                    page?.markdown ||
                    JSON.stringify(metaFile?.jsonData, null, 2) ||
                    '',
            }
        },
    })
    .route({
        method: 'POST',
        path: '/generateMessage',
        request: z.object({
            messages: z.array(z.custom<UIMessage>()),
            siteId: z.string(),
            chatId: z.string(),
            tabId: z.string(),
            currentSlug: z.string(),
            filesInDraft: z.record(
                z.object({ githubPath: z.string(), markdown: z.string() }),
            ),
        }),
        async *handler({ request, state: { userId } }) {
            const {
                messages,
                currentSlug,
                chatId,
                siteId,
                tabId,
                filesInDraft,
            } = await request.json()
            // First, check if the user can access the requested tab
            const tab = await prisma.tab.findFirst({
                where: {
                    tabId,
                    site: {
                        org: {
                            users: {
                                some: {
                                    userId,
                                },
                            },
                        },
                    },
                },
            })
            if (!tab) {
                throw new Error('You do not have access to this tab')
            }
            let model = openai.responses('gpt-4.1')
            // model = anthropic('claude-3-5-haiku-latest')
            const editFilesExecute = createEditExecute({
                filesInDraft,
                async validateNewContent(x) {
                    if (mdxRegex.test(x.githubPath)) {
                        await processMdxInServer({
                            markdown: x.content,
                            extension: path.extname(x.githubPath),
                        })
                    }
                },
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

            const str_replace_editor = model.modelId.includes('claude')
                ? anthropic.tools.textEditor_20250124({
                      execute: editFilesExecute as any,
                  })
                : tool({
                      parameters: editToolParamsSchema,
                      execute: editFilesExecute,
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
                            const [pages, metaFiles, mediaAssets] =
                                await Promise.all([
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
                                ...pages.map(
                                    (x) => ({ ...x, type: 'page' }) as const,
                                ),
                                ...metaFiles.map(
                                    (x) => ({ ...x, type: 'meta' }) as const,
                                ),
                                ...mediaAssets.map(
                                    (x) => ({ ...x, type: 'media' }) as const,
                                ),
                            ].flat()

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
                async onFinish({ response }) {
                    const resultMessages = appendResponseMessages({
                        messages,
                        responseMessages: response.messages,
                    })
                    console.log(resultMessages)
                    await prisma.$transaction(async (tx) => {
                        const prevChat = await tx.chat.delete({
                            where: { chatId },
                        })

                        const chatRow = await tx.chat.create({
                            data: {
                                ...prevChat,
                                chatId,
                                createdAt: prevChat.createdAt,
                                userId,
                                siteId,
                                currentSlug,
                                filesInDraft: filesInDraft || {},
                                title: null,
                            },
                        })

                        for (const [msgIdx, msg] of resultMessages.entries()) {
                            const parts = msg.parts || []

                            if (
                                msg.role !== 'assistant' &&
                                msg.role !== 'user'
                            ) {
                                console.log(
                                    `ignoring message with role ${msg.role}`,
                                )
                                msg.role
                                continue
                            }
                            const chatMessage = await tx.chatMessage.create({
                                data: {
                                    chatId: chatRow.chatId,
                                    createdAt: msg.createdAt,
                                    id: msg.id,
                                    role: msg.role ?? 'user',
                                },
                            })
                            for (const [index, part] of parts.entries()) {
                                // Handle only 'text', 'reasoning', and 'tool-invocation' types for now
                                if (part.type === 'text') {
                                    // ChatMessagePart: { type: 'text', text: string }
                                    await tx.chatMessagePart.create({
                                        data: {
                                            messageId: chatMessage.id,
                                            type: 'text',

                                            index,
                                            text: part.text,
                                        },
                                    })
                                } else if (part.type === 'reasoning') {
                                    // ChatMessagePart: { type: 'reasoning', text: string }
                                    await tx.chatMessagePart.create({
                                        data: {
                                            messageId: chatMessage.id,
                                            type: 'reasoning',

                                            text: part.reasoning,
                                            index,
                                        },
                                    })
                                } else if (part.type === 'tool-invocation') {
                                    // ChatMessagePart: { type: 'tool-invocation', json: any }
                                    await tx.chatMessagePart.create({
                                        data: {
                                            index,
                                            messageId: chatMessage.id,
                                            type: part.type,
                                            text: null,
                                        },
                                    })
                                } else {
                                    console.log(
                                        `skipping message of type ${part.type} in the database`,
                                    )
                                    part.type
                                }
                                // Ignore all other part types for now
                            }
                        }
                    })
                },
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
