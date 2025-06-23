import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai'

import dedent from 'string-dedent'

import { anthropic } from '@ai-sdk/anthropic'
import {
    appendResponseMessages,
    generateObject,
    generateText,
    Message,
    streamText,
    tool,
    UIMessage,
} from 'ai'
import { prisma } from 'db'
import { s3 } from 'docs-website/src/lib/s3'
import { Spiceflow } from 'spiceflow'
import { openapi } from 'spiceflow/openapi'
import { z } from 'zod'
import { getSession } from './better-auth'
import { env } from './env'
import { AppError, notifyError } from './errors'
import {
    createPullRequestSuggestion,
    getOctokit,
    pushToPrOrBranch,
} from './github.server'
import { filesFromGithub, syncSite } from './sync'
import { mdxRegex, sleep } from './utils'

import { printDirectoryTree } from '../components/directory-tree'
import {
    createEditExecute,
    editToolParamsSchema,
    FileUpdate,
    fileUpdateSchema,
} from './edit-tool'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import path from 'path'
import { RenderFormParameters } from './ui-field'

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
            filesInDraft: z.record(fileUpdateSchema),
        }),
        async *handler({ request, waitUntil, state: { userId } }) {
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

                    render_form: tool({
                        description:
                            'Render a series of input elements so the user can provide structured data. Array-style names such as items[0].color are supported.',
                        parameters: RenderFormParameters,
                        execute: async ({ fields }) => {
                            return {
                                fields,
                                success: true,
                                message: 'Form rendered successfully',
                            }
                        },
                    }),
                },
                async onFinish({ response }) {
                    const resultMessages = appendResponseMessages({
                        messages,
                        responseMessages: response.messages,
                    })
                    console.log(resultMessages)

                    await prisma.$transaction(async (prisma) => {
                        const prevChat = await prisma.chat.delete({
                            where: { chatId },
                        })

                        const chatRow = await prisma.chat.create({
                            data: {
                                chatId,
                                createdAt: prevChat.createdAt,
                                userId,
                                siteId,
                                currentSlug,
                                filesInDraft: filesInDraft || {},
                                lastPushedFiles: prevChat.lastPushedFiles || {},
                                title: prevChat.title,
                                prNumber: prevChat.prNumber,
                                description: prevChat.description,
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
                            const content =
                                msg.content ||
                                parts
                                    .filter((x: any) => x.type === 'text')
                                    .reduce(
                                        (acc: string, cur: any) =>
                                            acc + cur.text,
                                        '\n',
                                    )
                            const chatMessage = await prisma.chatMessage.create(
                                {
                                    data: {
                                        chatId: chatRow.chatId,
                                        createdAt: msg.createdAt,
                                        id: msg.id,
                                        content,
                                        role: msg.role ?? 'user',
                                    },
                                },
                            )
                            for (const [index, part] of parts.entries()) {
                                // Handle only 'text', 'reasoning', and 'tool-invocation' types for now
                                if (part.type === 'text') {
                                    // ChatMessagePart: { type: 'text', text: string }
                                    await prisma.chatMessagePart.create({
                                        data: {
                                            messageId: chatMessage.id,
                                            type: 'text',

                                            index,
                                            text: part.text,
                                        },
                                    })
                                } else if (part.type === 'reasoning') {
                                    // ChatMessagePart: { type: 'reasoning', text: string }
                                    await prisma.chatMessagePart.create({
                                        data: {
                                            messageId: chatMessage.id,
                                            type: 'reasoning',

                                            text: (part as any).reasoning,
                                            index,
                                        },
                                    })
                                } else if (part.type === 'tool-invocation') {
                                    // ChatMessagePart: { type: 'tool-invocation', json: any }
                                    await prisma.chatMessagePart.create({
                                        data: {
                                            index,
                                            messageId: chatMessage.id,
                                            type: part.type,
                                            toolInvocation:
                                                part.toolInvocation as any,
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
                    waitUntil(
                        generateAndSaveChatTitle({
                            resultMessages,
                            chatId,
                            userId,
                        }).catch(notifyError),
                    )
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
        async handler({ request, state: { userId } }) {
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
            const pages = filesFromGithub({
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
    .route({
        method: 'POST',
        path: '/newChat',
        request: z.object({
            siteId: z.string(),
            orgId: z.string(),
        }),
        async handler({ request, state: { userId } }) {
            const { siteId, orgId } = await request.json()

            if (!userId) {
                throw new Error('User not authenticated')
            }

            // Check if user has access to this site through org membership
            const orgUser = await prisma.orgsUsers.findUnique({
                where: {
                    userId_orgId: {
                        userId,
                        orgId,
                    },
                },
            })

            if (!orgUser) {
                throw new Error('You do not have access to this organization')
            }

            // Verify the site exists and user has access
            const site = await prisma.site.findUnique({
                where: {
                    siteId,
                    org: {
                        users: {
                            some: { userId },
                        },
                    },
                },
            })

            if (!site) {
                throw new Error('Site not found or access denied')
            }

            // Create a new chat
            const newChat = await prisma.chat.create({
                data: {
                    siteId,
                    userId,
                    title: null,
                    currentSlug: null,
                    filesInDraft: {},
                },
            })

            return {
                success: true,
                chatId: newChat.chatId,
            }
        },
    })

    .route({
        method: 'POST',
        path: '/createPrSuggestionForChat',
        request: z.object({
            siteId: z.string().min(1, 'siteId is required'),
            chatId: z.string().min(1, 'chatId is required'),
            // branchId: z.string().min(1, 'branchId is required'),
            filesInDraft: z.record(fileUpdateSchema),
        }),
        async handler({ request, state }) {
            const { userId } = state
            const { siteId, filesInDraft, chatId } = await request.json()

            if (!userId) {
                throw new AppError('Missing userId')
            }

            // Check user has access to the site
            const [site, chat] = await Promise.all([
                prisma.site.findFirst({
                    where: {
                        siteId,
                        chats: {
                            some: {
                                chatId,
                            },
                        },
                        org: {
                            users: {
                                some: { userId },
                            },
                        },
                    },
                    include: {
                        githubInstallation: true,
                    },
                }),
                prisma.chat.findFirst({
                    where: {
                        chatId,
                        userId,
                    },
                }),
            ])

            if (!site) {
                throw new AppError('Site not found or access denied')
            }
            if (!chat) {
                throw new AppError('Chat not found or access denied')
            }
            if (!site.githubInstallation) {
                throw new AppError('GitHub installation for site not found')
            }
            const installationId = site.githubInstallation.installationId

            // Get GitHub installation
            const githubInstallation = site.githubInstallation

            if (!githubInstallation) {
                throw new AppError('Missing GitHub installation')
            }

            const octokit = await getOctokit({ installationId })

            if (!chat) {
                throw new AppError('Chat not found')
            }

            // Convert filesInDraft to files format
            const files = Object.entries(filesInDraft).map(
                ([filePath, fileUpdate]) => ({
                    filePath,
                    content: fileUpdate.content || '',
                }),
            )

            // If chat already has a PR, push to the existing PR branch
            if (chat.prNumber) {
                console.log(
                    `Chat ${chatId} has existing PR #${chat.prNumber}, attempting to push to existing PR`,
                )

                // Get the existing PR details
                const { data: existingPr } = await octokit.rest.pulls.get({
                    owner: site.githubOwner,
                    repo: site.githubRepo,
                    pull_number: chat.prNumber,
                })

                console.log(
                    `Found existing PR #${chat.prNumber} with branch: ${existingPr.head.ref}`,
                )

                // Push to the existing PR branch using pushToPrOrBranch
                const result = await pushToPrOrBranch({
                    auth: site.githubInstallation.oauthToken || '',
                    files,
                    owner: site.githubOwner,
                    repo: site.githubRepo,
                    branch: existingPr.head.ref,
                    message: chat.title || '',
                })

                console.log(
                    `Successfully pushed to existing PR #${chat.prNumber}`,
                )

                // Update chat with the new PR number
                await prisma.chat.update({
                    where: { chatId, userId },
                    data: {
                        lastPushedFiles: filesInDraft,
                    },
                })
                return { prUrl: result.prUrl || existingPr.html_url }
            }

            // Create a new PR (either first time or if existing PR was not found)
            console.log(`Creating new PR for chat ${chatId}`)

            const { data: repoData } = await octokit.rest.repos.get({
                owner: site.githubOwner,
                repo: site.githubRepo,
            })
            const branch = repoData.default_branch

            const { url, prNumber } = await createPullRequestSuggestion({
                files,
                octokit,
                owner: site.githubOwner,
                repo: site.githubRepo,
                branch,
                accountLogin: '',
                fork: false,
                title: chat.title || 'Update documentation',
                body:
                    (chat as any).description ??
                    'Updated content from FumaBase assistant.',
            })

            console.log(`Successfully created new PR #${prNumber} at ${url}`)

            // Update chat with the new PR number
            await prisma.chat.update({
                where: { chatId, userId },
                data: {
                    prNumber,
                    lastPushedFiles: filesInDraft,
                },
            })

            return { prUrl: url }
        },
    })

    .route({
        method: 'POST',
        path: '/commitChangesToRepo',
        request: z.object({
            siteId: z.string().min(1, 'siteId is required'),
            filesInDraft: z.record(fileUpdateSchema),
        }),
        async handler({ request, state: { userId } }) {
            const { siteId, filesInDraft } = await request.json()

            if (!userId) {
                throw new AppError('Missing userId')
            }

            // Check user has access to the site
            const site = await prisma.site.findFirst({
                where: {
                    siteId,
                    org: {
                        users: {
                            some: { userId },
                        },
                    },
                },
                include: {
                    githubInstallation: true,
                },
            })

            if (!site) {
                throw new AppError('Site not found or access denied')
            }

            if (!site.githubInstallation) {
                throw new AppError('GitHub installation not found')
            }

            const installationId = site.githubInstallation.installationId
            const octokit = await getOctokit({ installationId })

            const owner = site.githubOwner
            const repo = site.githubRepo

            // Get the default branch of the repo
            const { data: repoData } = await octokit.rest.repos.get({
                owner,
                repo,
            })
            const branch = repoData.default_branch

            // Convert filesInDraft to files format
            const files = Object.entries(filesInDraft).map(
                ([filePath, fileUpdate]) => ({
                    filePath,
                    content: fileUpdate.content || '',
                }),
            )

            try {
                const result = await pushToPrOrBranch({
                    auth: site.githubInstallation.oauthToken || '',
                    files,
                    owner,
                    repo,
                    branch,
                })

                return {
                    prUrl: result.prUrl || '',
                    commitUrl: result.commitUrl || '',
                    githubAuthUrl: '',
                }
            } catch (error) {
                throw new AppError(`Failed to commit changes: ${error.message}`)
            }
        },
    })

    .onError(({ error }) => {
        notifyError(error)
    })

async function generateAndSaveChatTitle(params: {
    resultMessages: Message[]
    chatId: string
    userId: string
}): Promise<{ title: string | null; description: string | null }> {
    // Extract conversation text
    const textMessages = params.resultMessages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => {
            const content =
                msg.content ||
                (msg.parts || [])
                    .filter(
                        (part) =>
                            part.type === 'text' ||
                            part.type === 'tool-invocation',
                    )
                    .map((part) => {
                        if (part.type === 'tool-invocation') {
                            return `[Tool: ${part.toolInvocation?.toolName}] ${JSON.stringify(part.toolInvocation?.args)}`
                        }
                        return part.text
                    })
                    .join('\n')
            return `${msg.role}: ${content}`
        })
        .join('\n\n')

    let chatInfo: { title: string | null; description: string | null } = {
        title: null,
        description: null,
    }

    if (textMessages.trim()) {
        try {
            const { object } = await generateObject({
                model: openai('gpt-4o-mini'),
                schema: z.object({
                    title: z
                        .string()
                        .describe(
                            'A short, descriptive title for the changes, 2-6 words.',
                        ),
                    description: z
                        .string()
                        .describe(
                            'A concise summary of the changes made, in a few sentences. Use markdown. This will be used as the body of a GitHub PR.',
                        ),
                }),
                messages: [
                    {
                        role: 'system',
                        content:
                            'Generate a title and description for a pull request based on this chat conversation. The title should be short and descriptive (2-6 words), and the description should summarize the changes. Do not use quotes or special formatting for the title.',
                    },
                    {
                        role: 'user',
                        content: `Here is the chat conversation:\n\n${textMessages}`,
                    },
                ],
            })
            chatInfo = {
                title: object.title.trim(),
                description: object.description.trim(),
            }
        } catch (error) {
            console.error('Failed to generate chat title:', error)
        }
    }
    // Save to DB
    await prisma.chat.update({
        where: { chatId: params.chatId, userId: params.userId },
        data: {
            title: chatInfo.title,
            description: chatInfo.description,
        },
    })
    return chatInfo
}

export type SpiceflowApp = typeof app
