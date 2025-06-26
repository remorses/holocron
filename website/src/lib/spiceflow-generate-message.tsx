import { anthropic } from '@ai-sdk/anthropic'
import dedent from 'string-dedent'
import { OpenAIResponsesProviderOptions, openai } from '@ai-sdk/openai'
import {
    Message,
    UIMessage,
    appendResponseMessages,
    generateObject,
    streamText,
    tool,
} from 'ai'
import { prisma } from 'db'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import path from 'path'
import { Spiceflow } from 'spiceflow'
import z from 'zod'
import { printDirectoryTree } from '../components/directory-tree'
import {
    createEditExecute,
    editToolParamsSchema,
    fileUpdateSchema,
} from './edit-tool'
import { notifyError } from './errors'
import {
    RenderFormParameters,
    createRenderFormExecute,
} from './render-form-tool'
import { mdxRegex } from './utils'

export const generateMessageApp = new Spiceflow().state('userId', '').route({
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
        const { messages, currentSlug, chatId, siteId, tabId, filesInDraft } =
            await request.json()
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
                if (x.githubPath.endsWith('.json')) {
                    try {
                        JSON.parse(x.content)
                    } catch (e) {
                        throw new Error('Invalid JSON in file content')
                    }
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
                        const allFiles = await getTabFilesWithoutContents({
                            tabId,
                        })
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

                    execute: createRenderFormExecute({}),
                }),
            },
            async onFinish({ response }) {
                console.log(`chat finished, saving the chat in database`)
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

                        if (msg.role !== 'assistant' && msg.role !== 'user') {
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
                                    (acc: string, cur: any) => acc + cur.text,
                                    '\n',
                                )
                        const chatMessage = await prisma.chatMessage.create({
                            data: {
                                chatId: chatRow.chatId,
                                createdAt: msg.createdAt,
                                id: msg.id,
                                content,
                                role: msg.role ?? 'user',
                            },
                        })
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

export async function getTabFilesWithoutContents({ tabId }) {
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
    return allFiles
}
