import { anthropic } from '@ai-sdk/anthropic'
import dedent from 'string-dedent'
import { OpenAIResponsesProviderOptions, openai } from '@ai-sdk/openai'
import {
    UIMessage,
    generateObject,
    streamText,
    tool,
    convertToModelMessages,
    stepCountIs,
    isToolUIPart,
} from 'ai'
import { prisma } from 'db'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import path from 'path'
import { Spiceflow } from 'spiceflow'
import z from 'zod'
import { printDirectoryTree } from '../components/directory-tree'
import {
    createEditExecute,
    EditToolParamSchema,
    editToolParamsSchema,
    fileUpdateSchema,
} from './edit-tool'
import { notifyError } from './errors'
import {
    RenderFormParameters,
    createRenderFormExecute,
} from './render-form-tool'
import { mdxRegex } from './utils'
import Handlebars from 'handlebars'
import { docsJsonSchema } from 'docs-website/src/lib/docs-json'
import agentPrompt from '../prompts/agent.md?raw'
import { readableStreamToAsyncIterable } from 'contesto/src/lib/utils'

const agentPromptTemplate = Handlebars.compile(agentPrompt)

const deletePagesSchema = z.object({
    filePaths: z
        .array(z.string())
        .describe('Array of file paths to delete from the website'),
})

export type WebsiteTools = {
    str_replace_editor: {
        input: EditToolParamSchema
        output: any
    }
    get_project_files: {
        input: {}
        output: string
    }
    render_form: {
        input: RenderFormParameters //
        output: any
    }
    delete_pages: {
        input: z.infer<typeof deletePagesSchema>
        output: {
            deletedFiles: string[]
        }
    }
}

export const generateMessageApp = new Spiceflow().state('userId', '').route({
    method: 'POST',
    path: '/generateMessage',
    request: z.object({
        messages: z.array(z.custom<UIMessage>()),
        siteId: z.string(),
        chatId: z.string(),
        branchId: z.string(),
        currentSlug: z.string(),
        filesInDraft: z.record(fileUpdateSchema),
    }),
    async *handler({ request, waitUntil, state: { userId } }) {
        const {
            messages,
            currentSlug,
            chatId,
            siteId,
            branchId,
            filesInDraft,
        } = await request.json()
        // First, check if the user can access the requested branch
        const branch = await prisma.siteBranch.findFirst({
            where: {
                branchId,
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
            include: {
                site: true,
            },
        })
        if (!branch) {
            throw new Error('You do not have access to this branch')
        }
        let model = openai.responses('gpt-4.1')
        // model = anthropic('claude-3-5-haiku-latest')
        const editFilesExecute = createEditExecute({
            filesInDraft,
            async getPageContent({ githubPath }) {
                const content = await getPageContent({ githubPath, branchId })
                return content
            },
            async validateNewContent(x) {
                if (mdxRegex.test(x.githubPath)) {
                    await processMdxInServer({
                        markdown: x.content,
                        githubPath: x.githubPath,
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
        })

        const str_replace_editor = model.modelId.includes('claude')
            ? anthropic.tools.textEditor_20250124({
                  execute: editFilesExecute as any,
              })
            : tool({
                  inputSchema: editToolParamsSchema,
                  execute: editFilesExecute,
              })

        const result = streamText({
            model,
            messages: [
                {
                    role: 'system',
                    content: agentPromptTemplate({
                        docsJsonSchema: JSON.stringify(docsJsonSchema, null, 2),
                    }),
                },
                ...convertToModelMessages(
                    messages.filter((x) => x.role !== 'system'),
                ),
            ],
            stopWhen: stepCountIs(100),

            providerOptions: {
                openai: {
                    reasoningSummary: 'detailed',
                } satisfies OpenAIResponsesProviderOptions,
            },
            tools: {
                str_replace_editor,

                get_project_files: tool({
                    description:
                        'Returns a directory tree diagram of the current project files as plain text. Useful for giving an overview or locating files.',
                    inputSchema: z.object({}),
                    execute: async () => {
                        const allFiles = await getTabFilesWithoutContents({
                            branchId,
                        })
                        let filePaths = allFiles.map((x) => {
                            const path = x.githubPath
                            let title = ''
                            if (x.type === 'page') {
                                title = x.title
                            }
                            return { path, title }
                        })
                        filePaths.push({
                            path: path.posix.join(
                                branch.site.githubFolder || '.',
                                'fumabase.jsonc',
                            ),
                            title: 'Use the render_form tool to update these values',
                        })
                        // filePaths.push({ path: 'styles.css', title: 'The CSS styles for the website. Only update this file for advanced CSS customisations' })
                        return printDirectoryTree({
                            filePaths,
                        })
                    },
                }),

                render_form: tool({
                    description:
                        'Render a series of input elements so the user can provide structured data. Array-style names such as items[0].color are supported.',
                    inputSchema: RenderFormParameters,

                    execute: createRenderFormExecute({}),
                }),

                delete_pages: tool({
                    description:
                        'Delete pages from the website. paths should never start with /. Paths should include the extension.',
                    inputSchema: deletePagesSchema,
                    execute: async ({ filePaths }) => {
                        const deletedFiles: string[] = []

                        for (const filePath of filePaths) {
                            const content = await getPageContent({
                                githubPath: filePath,
                                branchId,
                            }).catch(() => null)
                            const lineCount =
                                typeof content === 'string'
                                    ? content.split('\n').length
                                    : 1
                            filesInDraft[filePath] = {
                                content: null,
                                githubPath: filePath,
                                deletedLines: lineCount,
                            }
                            deletedFiles.push(filePath)
                        }

                        return { deletedFiles }
                    },
                }),
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

        const lastUserMessage = messages.findLast((x) => x.role === 'user')
        if (lastUserMessage) {
            console.log(`creating message for`, lastUserMessage)
            // Extract text content from parts
            const content = lastUserMessage.parts
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('')

            // create the user message so it shows up when resuming chat
            await prisma.chatMessage.upsert({
                where: {
                    id: lastUserMessage.id,
                },
                update: {
                    createdAt: new Date(),

                    role: 'user',
                },
                create: {
                    chatId,
                    createdAt: new Date(),
                    id: lastUserMessage.id,

                    role: 'user',
                },
            })
        }
        const stream = result.toUIMessageStream({
            // originalMessages: messages,
            messageMetadata: () => {
                return {
                    createdAt: new Date(),
                }
            },
            async onFinish({ messages: uiMessages }) {
                console.log(`chat finished, saving the chat in database`)
                const resultMessages = [...messages, ...uiMessages]
                console.log(resultMessages)

                const previousMessages = await prisma.chatMessage.findMany({
                    where: { chatId },

                    orderBy: { createdAt: 'asc' },
                })
                await prisma.$transaction(async (prisma) => {
                    // Get previous message parts
                    const prevChat = await prisma.chat
                        .delete({
                            where: { chatId },
                        })
                        .catch((e) => null)

                    const chatRow = await prisma.chat.create({
                        data: {
                            chatId,
                            createdAt: prevChat?.createdAt,
                            userId,
                            branchId,
                            currentSlug,
                            filesInDraft: filesInDraft || {},
                            lastPushedFiles: prevChat?.lastPushedFiles || {},
                            title: prevChat?.title,
                            prNumber: prevChat?.prNumber,
                            description: prevChat?.description,
                        },
                    })

                    for (const [msgIdx, msg] of resultMessages.entries()) {
                        const parts = 'parts' in msg ? msg.parts || [] : []

                        if (msg.role !== 'assistant' && msg.role !== 'user') {
                            console.log(
                                `ignoring message with role ${msg.role}`,
                            )
                            msg.role
                            continue
                        }
                        const content =
                            ('content' in msg ? msg.content : null) ||
                            parts
                                .filter((x: any) => x.type === 'text')
                                .reduce(
                                    (acc: string, cur: any) => acc + cur.text,
                                    '\n',
                                )
                        const prevMessage = previousMessages.find(
                            (x) => x.id === msg.id,
                        )
                        const chatMessage = await prisma.chatMessage.create({
                            data: {
                                chatId: chatRow.chatId,

                                id: msg.id,
                                createdAt: prevMessage?.createdAt || new Date(),
                                role: msg.role ?? 'user',
                            },
                        })
                        for (const [index, part] of parts.entries()) {
                            // Handle only 'text', 'reasoning', and 'tool-invocation' types for now
                            if (part.type === 'text') {
                                // ChatMessagePart: { type: 'text', text: string }
                                await prisma.chatPartText.create({
                                    data: {
                                        messageId: chatMessage.id,
                                        type: 'text',

                                        index,
                                        text: part.text,
                                    },
                                })
                            } else if (part.type === 'reasoning') {
                                // ChatMessagePart: { type: 'reasoning', text: string }
                                await prisma.chatPartReasoning.create({
                                    data: {
                                        messageId: chatMessage.id,
                                        type: 'reasoning',
                                        text: part.text,
                                        index,
                                    },
                                })
                            } else if (isToolUIPart(part)) {
                                const { input, toolCallId } = part
                                if (part.state === 'output-available') {
                                    await prisma.chatPartTool.create({
                                        data: {
                                            index,
                                            input: input as any,
                                            output: part.output as any,
                                            toolCallId,
                                            messageId: chatMessage.id,
                                            state: part.state,
                                            type: part.type,
                                        },
                                    })
                                } else if (part.state === 'output-error') {
                                    await prisma.chatPartTool.create({
                                        data: {
                                            index,
                                            input: input as any,
                                            errorText: part.errorText,
                                            toolCallId,
                                            messageId: chatMessage.id,
                                            state: part.state,
                                            type: part.type,
                                        },
                                    })
                                } else {
                                    console.log(
                                        `unhandled part tool type with state ${part.state}`,
                                    )
                                }
                            } else if (part.type === 'file') {
                                // Handle ChatPartFile
                                await prisma.chatPartFile.create({
                                    data: {
                                        messageId: chatMessage.id,
                                        type: 'file',
                                        index,
                                        mediaType: part.mediaType,
                                        filename: part.filename,
                                        url: part.url,
                                    },
                                })
                            } else if (part.type === 'source-url') {
                                // Handle ChatPartSourceUrl
                                await prisma.chatPartSourceUrl.create({
                                    data: {
                                        messageId: chatMessage.id,
                                        type: 'source-url',
                                        index,
                                        sourceId: part.sourceId,
                                        url: part.url,
                                        title: part.title,
                                        providerMetadata:
                                            part.providerMetadata as any,
                                    },
                                })
                            } else {
                                part.type
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
        })
        yield* readableStreamToAsyncIterable(stream)
    },
})

async function generateAndSaveChatTitle(params: {
    resultMessages: UIMessage[]
    chatId: string
    userId: string
}): Promise<{ title: string | null; description: string | null }> {
    // Extract conversation text
    const textMessages = params.resultMessages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => {
            const content =
                ('content' in msg ? msg.content : null) ||
                (msg.parts || [])
                    .filter(
                        (part) =>
                            part.type === 'text' ||
                            part.type.startsWith('tool-'),
                    )
                    .map((part) => {
                        if ('input' in part) {
                            if (part.state === 'input-available') {
                                return `[Tool: ${part.type}] ${JSON.stringify(part.input)}`
                            }
                        }
                        if (part.type === 'text') return part.text
                        return ''
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

export async function getTabFilesWithoutContents({ branchId }) {
    const [pages, metaFiles, mediaAssets] = await Promise.all([
        prisma.markdownPage.findMany({
            where: {
                branchId,
            },
        }),
        prisma.metaFile.findMany({
            where: {
                branchId,
            },
            omit: {
                jsonData: true,
            },
        }),
        prisma.mediaAsset.findMany({
            where: {
                branchId,
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

export async function getPageContent({ githubPath, branchId }) {
    // Support for special files: fumabase.jsonc and styles.css
    if (githubPath.endsWith('fumabase.jsonc')) {
        const branch = await prisma.siteBranch.findFirst({
            where: { branchId },
            select: { docsJson: true },
        })
        if (!branch || !branch.docsJson) {
            throw new Error(`Cannot find fumabase.jsonc for branch ${branchId}`)
        }
        return (
            `> Notice that this is the fumabase.jsonc file before any form updates. Form updates are not saved on the filesystem until save! There is no need to inspect that your changes where succesful. \n\n` +
            JSON.stringify(branch.docsJson, null, 2)
        )
    }
    if (githubPath.endsWith('/styles.css') || githubPath === 'styles.css') {
        const branch = await prisma.siteBranch.findFirst({
            where: { branchId },
            select: { cssStyles: true },
        })
        if (!branch) {
            throw new Error(`Cannot find styles.css for branch ${branchId}`)
        }
        // Could be null if not set
        return branch.cssStyles || ''
    }
    // Otherwise, try page and metaFile
    const [page, metaFile] = await Promise.all([
        prisma.markdownPage.findFirst({
            where: {
                branchId,
                githubPath,
            },
        }),
        prisma.metaFile.findFirst({
            where: {
                branchId,
                githubPath,
            },
        }),
    ])
    if (!page && !metaFile) {
        throw new Error(`Cannot find page in ${githubPath}`)
    }
    if (page) {
        // Get the content from the MarkdownBlob relation
        const pageWithContent = await prisma.markdownPage.findFirst({
            where: {
                branchId,
                githubPath,
            },
            include: {
                content: true,
            },
        })
        return pageWithContent?.content.markdown || ''
    }
    return JSON.stringify(metaFile?.jsonData, null, 2) || ''
}
