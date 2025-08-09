import { anthropic } from '@ai-sdk/anthropic'
import fs from 'fs'
import { AnySpiceflow, preventProcessExitIfBusy } from 'spiceflow'
import { groq } from '@ai-sdk/groq'
import dedent from 'string-dedent'
import {
    OpenAIResponsesProviderOptions,
    openai,
    createOpenAI,
} from '@ai-sdk/openai'
import {
    UIMessage,
    generateObject,
    streamText,
    smoothStream,
    tool,

    convertToModelMessages,
    stepCountIs,
    isToolUIPart,
    createIdGenerator,
    Tool,
    ModelMessage,
    wrapLanguageModel,
} from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { type LanguageModelV2Middleware } from '@ai-sdk/provider'
import { prisma, Prisma } from 'db'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import path from 'path'
import { Spiceflow } from 'spiceflow'
import z from 'zod'
import { printDirectoryTree } from 'docs-website/src/lib/directory-tree'
import {
    createEditTool,
    EditToolParamSchema,
    editToolParamsSchema,
    fileUpdateSchema,
    type FileUpdate,
} from 'docs-website/src/lib/edit-tool'
import { FileSystemEmulator } from './file-system-emulator'
import { notifyError } from './errors'
import { createRenderFormTool, RenderFormParameters } from 'contesto'
import { mdxRegex as mdxOrMdRegex } from './utils'
import {
    searchDocsInputSchema,
    goToPageInputSchema,
    getCurrentPageInputSchema,
    selectTextInputSchema,
    type SearchDocsInput,
    type GoToPageInput,
    type GetCurrentPageInput,
    type SelectTextInput,
} from './shared-docs-tools'
import {
    searchDocsWithEyecrest,
    formatEyecrestSearchResults,
} from 'docs-website/src/lib/eyecrest-search'
import { cleanSlug } from 'docs-website/src/lib/slug-utils'
import { getFilesForSource } from 'docs-website/src/lib/source.server'
import { getFumadocsSource } from 'docs-website/src/lib/source'
import { VirtualFile } from 'fumadocs-core/source'
import Handlebars from 'handlebars'
import { docsJsonSchema } from 'docs-website/src/lib/docs-json'

import exampleDocs from 'website/scripts/example-docs.json'
import { readableStreamToAsyncIterable } from 'contesto/src/lib/utils'
import { ProcessorDataFrontmatter } from 'docs-website/src/lib/mdx-heavy'
import fm from 'front-matter'
import { isValidLucideIconName } from './icons'

/**
 * Generate the system message content for the AI
 */
export async function generateSystemMessage({
    isOnboardingChat,
}): Promise<string> {
    return [
        await import('../prompts/agent.md?raw').then((x) => x.default),
        await import('../prompts/tone-and-style.md?raw').then((x) => x.default),
        await import('../prompts/writing-mdx.md?raw').then((x) => x.default),
        await import('../prompts/css-variables.md?raw').then((x) => x.default),
        await import('../prompts/frontmatter.md?raw').then((x) => x.default),
        dedent`
        ## fumabase.jsonc

        You can edit a top level fumabase.jsonc file to customize website settings, this file has the following json schema:

        <fumabaseJsonSchema>
        ${JSON.stringify(docsJsonSchema, null, 2)}
        </fumabaseJsonSchema>
        `,
        isOnboardingChat && '## Onboarding Instructions',
        isOnboardingChat &&
            (await import('../prompts/create-site.md?raw').then(
                (x) => x.default,
            )),
        isOnboardingChat && generateExampleTemplateFilesPrompt(),
    ]
        .filter(Boolean)
        .join('\n\n')
}

function generateExampleTemplateFilesPrompt() {
    let templateContents = ''
    for (const doc of exampleDocs) {
        if (doc.encoding === 'base64') continue
        if (!doc.content) continue
        templateContents += '\n'
        templateContents += dedent`
        <page>
          <filename>${doc.filePath}</filename>
          <content>
          ${doc.content}
          </content>
        </page>
        `
    }
    return dedent`
    ## example template files

    If the user query is very short or nonsensical, do not reply back with a question. Assume the user is very lazy and will never reply back.
    Instead generate the following template website, replace a few fields with data you can deduce from the user if possible or add new pages related to the user query.

    When creating the using template content, fill the content in right away. Do not leave them empty with only the frontmatter.

    After creating the template pages ask the user back for more information to customize the site to the user needs. Then start updating all pages to align to the user requirements.

    <template>
    ${templateContents}
    </template>
    `
}

const deletePagesSchema = z.object({
    filePaths: z
        .array(z.string())
        .describe('Array of file paths to delete from the website'),
})

const renameFileSchema = z.object({
    oldPath: z
        .string()
        .describe(
            'The current file path to rename. Must include the file extension.',
        ),
    newPath: z
        .string()
        .describe(
            'The new file path. Must include the file extension. The parent directory must exist or be created first.',
        ),
})

// Website-specific fetchUrl schema that requires absolute URLs
const websiteFetchUrlInputSchema = z.object({
    url: z
        .string()
        .describe(
            'The absolute URL to fetch. Must start with https://. Use this to fetch content from external websites.',
        ),
})

export type WebsiteTools = {
    strReplaceEditor: {
        input: EditToolParamSchema
        output: any
    }
    getProjectFiles: {
        input: {}
        output: string
    }
    updateFumabaseJsonc: {
        input: RenderFormParameters
        output: any
    }
    renderForm: {
        input: RenderFormParameters
        output: any
    }
    deletePages: {
        input: z.infer<typeof deletePagesSchema>
        output: {
            deletedFiles: string[]
        }
    }
    searchDocs: {
        input: SearchDocsInput
        output: any
    }
    goToPage: {
        input: GoToPageInput
        output: {
            slug: string
            error?: string
        }
    }
    getCurrentPage: {
        input: GetCurrentPageInput
        output: any
    }
    fetchUrl: {
        input: z.infer<typeof websiteFetchUrlInputSchema>
        output: any
    }
    selectText: {
        input: SelectTextInput
        output: {
            slug: string
            startLine?: number
            endLine?: number
            error?: string
        }
    }
    renameFile: {
        input: z.infer<typeof renameFileSchema>
        output: {
            oldPath: string
            newPath: string
            success: boolean
            error?: string
        }
    }
}

/**
 * Stateless function for generating messages - no Prisma dependency
 */
export async function* generateMessageStream({
    messages,
    currentSlug,
    filesInDraft,
    fileSystem,
    files,
    githubFolder,
    defaultLocale,
    locales,
    branchId,
    modelId,
    modelProvider,
    onFinish,
    middlewares,
}: {
    messages: UIMessage[]
    currentSlug: string
    filesInDraft: Record<string, FileUpdate>
    fileSystem: FileSystemEmulator
    files: Array<VirtualFile & { data?: ProcessorDataFrontmatter }> // Files from getFilesForSource
    githubFolder: string
    defaultLocale: string
    locales: string[]
    branchId: string
    modelId?: string | null
    modelProvider?: string | null
    onFinish?: (params: {
        uiMessages: UIMessage[]
        isAborted: boolean
        model: { modelId: string; provider: string }
    }) => Promise<void>
    middlewares?: LanguageModelV2Middleware[]
}) {
    // Auto-detect onboarding mode based on filesInDraft
    const isOnboardingChat = Object.keys(filesInDraft).length === 0
    const source = getFumadocsSource({
        files,
        defaultLanguage: defaultLocale,

        languages: locales,
    })

    // let model = groq('moonshotai/kimi-k2-instruct')
    let model = gateway('moonshotai/kimi-k2')

    // if (modelId && modelProvider) {
    //     if (modelProvider.startsWith('openai')) {
    //         model = openai(modelId)
    //     } else if (modelProvider === 'anthropic') {
    //         model = anthropic(modelId)
    //     } else {
    //         // throw new Error(
    //         //     `Unsupported model provider: ${modelProvider}`,
    //         // )
    //     }
    // }

    // Apply middleware if provided
    if (middlewares && middlewares.length > 0) {
        model = wrapLanguageModel({
            model,
            middleware: middlewares,
        })
    }

    const docsJsonRenderFormTool = createRenderFormTool({
        jsonSchema: docsJsonSchema,
        replaceOptionalsWithNulls: model.provider.startsWith('openai'),
    })
    // model = anthropic('claude-3-5-haiku-latest')
    const strReplaceEditor = createEditTool({
        fileSystem,
        model: { provider: model.provider },
        async validateNewContent(x) {
            // Validate frontmatter icons for MDX/MD files
            if (mdxOrMdRegex.test(x.githubPath)) {
                const parsed = fm(x.content)
                const frontmatter = parsed.attributes as any

                if (frontmatter && frontmatter.icon) {
                    const iconName = String(frontmatter.icon)
                    if (!isValidLucideIconName(iconName)) {
                        throw new Error(
                            `you used an invalid icon "${iconName}", to see the possible icons fetch the url https://fumabase.com/lucide-icons.json`,
                        )
                    }
                }
            }

            if (mdxOrMdRegex.test(x.githubPath)) {
                try {
                    await processMdxInServer({
                        markdown: x.content,
                        githubPath: x.githubPath,
                        extension: path.extname(x.githubPath),
                    })
                } catch (error: any) {
                    // Extract error details
                    const errorLine =
                        error.line || error.position?.start?.line || 1
                    const errorColumn =
                        error.column || error.position?.start?.column || 1
                    const errorMessage =
                        error.reason || error.message || 'Unknown MDX error'

                    // Split markdown into lines
                    const lines = x.content.split('\n')

                    // Calculate line range to show (5 lines before and after the error)
                    const contextRange = 5
                    const startLine = Math.max(1, errorLine - contextRange)
                    const endLine = Math.min(
                        lines.length,
                        errorLine + contextRange,
                    )

                    // Build context message
                    let contextMessage = `MDX Compilation Error at line ${errorLine}, column ${errorColumn}:\n${errorMessage}\n\n`
                    contextMessage += 'Error Context:\n'

                    for (let i = startLine - 1; i < endLine; i++) {
                        const lineNumber = i + 1
                        const isErrorLine = lineNumber === errorLine
                        const line = lines[i] || ''

                        // Add line with line number
                        contextMessage += `${lineNumber.toString().padStart(3, ' ')} | ${line}\n`

                        // Add error indicator for the error line
                        if (isErrorLine && errorColumn) {
                            const padding = ' '.repeat(5 + errorColumn)
                            contextMessage += `${padding}^\n`
                        }
                    }

                    contextMessage +=
                        '\nPlease fix the MDX syntax error and submit the tool call again.'

                    throw new Error(contextMessage)
                }
            }
            if (x.githubPath.endsWith('.json')) {
                try {
                    JSON.parse(x.content)
                } catch (e: any) {
                    // Get line and column for JSON errors
                    let line = 1
                    let column = 1

                    // Try to extract position from error message
                    const posMatch = e.message.match(/position (\d+)/)
                    if (posMatch) {
                        const position = parseInt(posMatch[1])
                        const lines = x.content
                            .substring(0, position)
                            .split('\n')
                        line = lines.length
                        column = lines[lines.length - 1].length + 1
                    }

                    // Build context for JSON error
                    const lines = x.content.split('\n')
                    const contextRange = 5
                    const startLine = Math.max(1, line - contextRange)
                    const endLine = Math.min(lines.length, line + contextRange)

                    let contextMessage = `JSON Parse Error at line ${line}:\n${e.message}\n\n`
                    contextMessage += 'Error Context:\n'

                    for (let i = startLine - 1; i < endLine; i++) {
                        const lineNumber = i + 1
                        const isErrorLine = lineNumber === line
                        const lineContent = lines[i] || ''

                        contextMessage += `${lineNumber.toString().padStart(3, ' ')} | ${lineContent}\n`

                        if (isErrorLine && column) {
                            const padding = ' '.repeat(5 + column - 1)
                            contextMessage += `${padding}^\n`
                        }
                    }

                    contextMessage +=
                        '\nPlease fix the JSON syntax error and submit the tool call again.'

                    throw new Error(contextMessage)
                }
            }
        },
    })

    const tools = {
        strReplaceEditor,

        ...(isOnboardingChat
            ? {
                  renderForm: createRenderFormTool({
                      replaceOptionalsWithNulls:
                          model.provider.startsWith('openai'),
                  }),
              }
            : {
                  updateFumabaseJsonc: docsJsonRenderFormTool,
              }),

        getProjectFiles: tool({
            description:
                'Returns a directory tree diagram of the current project files as plain text. Useful for giving an overview or locating files.',
            inputSchema: z.object({}),
            execute: async () => {
                const filePaths = [...files].map((x) => {
                    const title = x.data?.title || ''
                    const p = path.posix.join(githubFolder, x.path)
                    return {
                        path: p,
                        title,
                    }
                })
                filePaths.push({
                    path: path.posix.join(
                        githubFolder || '.',
                        'fumabase.jsonc',
                    ),
                    title: 'Use the renderForm tool to update these values',
                })
                // filePaths.push({ path: 'styles.css', title: 'The CSS styles for the website. Only update this file for advanced CSS customisations' })
                return printDirectoryTree({
                    filePaths,
                })
            },
        }),

        deletePages: tool({
            description:
                'Delete pages from the website. paths should never start with /. Paths should include the extension.',
            inputSchema: deletePagesSchema,
            execute: async ({ filePaths }) => {
                try {
                    await fileSystem.deleteBatch(filePaths)
                    return { deletedFiles: filePaths }
                } catch (error) {
                    return {
                        deletedFiles: [],
                        error: error.message,
                    }
                }
            },
        }),

        // Add docs tools - these provide basic functionality for the website context
        searchDocs: tool({
            inputSchema: searchDocsInputSchema,
            execute: async ({ terms, searchType = 'fulltext' }) => {
                // Try using Eyecrest search if available, otherwise fallback to simple search
                try {
                    const results = await searchDocsWithEyecrest({
                        branchId: branchId,
                        query: terms,
                        exact: searchType === 'fulltext',
                    })
                    return formatEyecrestSearchResults({
                        results,
                        baseUrl: `${process.env.PUBLIC_URL || 'https://fumabase.com'}`,
                    })
                } catch (error) {
                    console.error(
                        'Eyecrest search failed, falling back to simple search:',
                        error,
                    )
                }

                // Fallback to simple search through existing files
                const pages = files.filter((x) => x.data)

                const results = pages.filter((page) => {
                    const title = page.data?.title || ''
                    const searchText = `${title} ${page.path}`.toLowerCase()
                    return terms.some((term) =>
                        searchText.includes(term.toLowerCase()),
                    )
                })

                return (
                    `Found ${results.length} pages matching search terms:\n` +
                    results
                        .map((page) => {
                            const title = page.data?.title || 'Untitled'
                            return `- ${title} (${page.path})`
                        })
                        .join('\n')
                )
            },
        }),

        goToPage: tool({
            inputSchema: goToPageInputSchema,
            execute: async ({ slug }) => {
                const cleanedSlug = cleanSlug(slug)
                const slugParts = cleanedSlug.split('/').filter(Boolean)
                const page = source.getPage(slugParts)

                if (!page) {
                    return { error: `Page ${cleanedSlug} not found` }
                }

                return {
                    slug: page.url,
                    message: `Found page: ${page.url}`,
                }
            },
        }),

        getCurrentPage: tool({
            inputSchema: getCurrentPageInputSchema,
            execute: async () => {
                return `Current page slug: ${currentSlug}`
            },
        }),

        fetchUrl: tool({
            description:
                'Fetch content from external websites. Only absolute HTTPS URLs are allowed.',
            inputSchema: websiteFetchUrlInputSchema,
            execute: async ({ url }) => {
                // Validate that URL starts with https://
                if (!url.startsWith('https://')) {
                    return `Error: Only HTTPS URLs are allowed. URL must start with https://`
                }

                try {
                    const response = await fetch(url)
                    if (!response.ok) {
                        return `Failed to fetch ${url}: ${response.status} ${response.statusText}`
                    }

                    const maxChars = 50_000
                    const contentType =
                        response.headers.get('content-type') || ''

                    if (contentType.includes('application/json')) {
                        const data = await response.json()
                        const jsonString = JSON.stringify(data, null, 2)
                        return (
                            jsonString.substring(0, maxChars) +
                            (jsonString.length > maxChars ? '...' : '')
                        )
                    } else if (contentType.includes('text/html')) {
                        const html = await response.text()
                        return (
                            html.substring(0, maxChars) +
                            (html.length > maxChars ? '...' : '')
                        )
                    } else {
                        const text = await response.text()
                        return (
                            text.substring(0, maxChars) +
                            (text.length > maxChars ? '...' : '')
                        )
                    }
                } catch (error) {
                    return `Error fetching ${url}: ${error.message}`
                }
            },
        }),

        selectText: tool({
            inputSchema: selectTextInputSchema,
            description: dedent`
            Select a range of lines inside a page to highlight some content for the user.

            Always use this tool when the user asks you to search something in the website.

            This tool is only useful as a way to highlight information to the user. It has no actual effect other than presentational, you should not use it unless the user is asking to search something in the website.

            This is the preferred way to show information to the user instead of quoting the page again in a message.

            Your messages should always be super short and concise.
            `,
            execute: async ({ slug, startLine, endLine }) => {
                const cleanedSlug = cleanSlug(slug)
                const slugParts = cleanedSlug.split('/').filter(Boolean)
                const page = source.getPage(slugParts)

                if (!page) {
                    return { error: `Page ${cleanedSlug} not found` }
                }

                return {
                    slug: page.url,
                    startLine,
                    endLine,
                    message: `Selected text on ${page.url} from line ${startLine} to ${endLine}`,
                }
            },
        }),

        renameFile: tool({
            description:
                'Rename or move a file within the website. This updates the file path while preserving its content. Ensure the parent directory exists before moving a file to a new location.',
            inputSchema: renameFileSchema,
            execute: async ({ oldPath, newPath }) => {
                try {
                    await fileSystem.move(oldPath, newPath)
                    return {
                        oldPath,
                        newPath,
                        success: true,
                    }
                } catch (error) {
                    return {
                        oldPath,
                        newPath,
                        success: false,
                        error: error.message,
                    }
                }
            },
        }),

        ...(model.provider === 'openai' && {
            webSearchOpenAI: openai.tools.webSearchPreview({
                searchContextSize: 'high',
            }),
        }),
        ...(model.provider === 'anthropic' && {
            webSearchAnthropic: anthropic.tools.webSearch_20250305({}),
        }),
    }

    const allMessages: ModelMessage[] = [
        {
            role: 'system',
            content: await generateSystemMessage({ isOnboardingChat }),
        },
        ...convertToModelMessages(messages.filter((x) => x.role !== 'system')),
    ]

    debugMessages(allMessages)

    const result = streamText({
        model,
        tools,
        onError: (error) => {
            console.log(`Error in streamText:`, error)
            throw error
        },
        experimental_transform: process.env.VITEST
            ? undefined
            : smoothStream({
                  delayInMs: 10,
                  chunking: 'word',
              }),
        messages: allMessages,
        stopWhen: stepCountIs(100),

        providerOptions: {
            zai: {
                thinking: {
                    type: 'disabled',
                },
            },
            openai: {
                reasoningSummary: 'detailed',
                strictJsonSchema: true,
                include: ['reasoning.encrypted_content'],
                store: false,
                reasoningEffort: 'low',
                parallelToolCalls: true,
            } satisfies OpenAIResponsesProviderOptions,
        },
    })

    const idGenerator = createIdGenerator()
    const stream = result.toUIMessageStream({
        onError: (error) => {
            console.error(`Error in toUIMessageStream:`, error)
            throw error
        },

        originalMessages: messages,
        generateMessageId: idGenerator,
        async onFinish({ messages: uiMessages, isAborted }) {
            console.log(
                `chat finished, processing`,
                isAborted ? 'aborted' : 'completed',
            )

            debugMessages(uiMessages, 'scripts/ui-result-messages.json')

            if (onFinish) {
                await onFinish({
                    uiMessages,
                    isAborted,
                    model: { modelId: model.modelId, provider: model.provider },
                })
            }
        },
    })
    for await (const message of stream) {
        yield message
    }
    await result.content
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
        filesInDraft: z.record(z.string(), fileUpdateSchema),
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
        // Fetch branch and chat in parallel for efficiency
        const [branch, chat, pageCount] = await Promise.all([
            prisma.siteBranch.findFirst({
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
                    site: {
                        include: {
                            locales: true,
                        },
                    },
                },
            }),
            prisma.chat.findFirst({
                where: {
                    chatId,
                },
            }),
            prisma.markdownPage.count({
                where: {
                    branchId,
                },
            }),
        ])
        if (!branch) {
            throw new Error('You do not have access to this branch')
        }

        // Create the last user message before streaming
        const lastUserMessage = messages.findLast((x) => x.role === 'user')
        if (lastUserMessage) {
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

        const githubFolder = branch.site.githubFolder || ''
        const files = await getFilesForSource({
            branchId,
            filesInDraft,
            githubFolder,
        })

        // Create FileSystemEmulator instance
        const fileSystem = new FileSystemEmulator({
            filesInDraft,
            getPageContent: async (githubPath) => {
                const content = await getPageContent({ githubPath, branchId })
                return content
            },
            onFilesDraftChange: async () => {
                // Update the chat with current filesInDraft state
                await prisma.chat.update({
                    where: { chatId, userId },
                    data: {
                        filesInDraft: (filesInDraft as any) || {},
                    },
                })
            },
        })

        // Use the extracted stateless function
        yield* generateMessageStream({
            messages,
            currentSlug,
            filesInDraft,
            fileSystem,
            files,
            githubFolder,
            defaultLocale: branch.site?.defaultLocale || 'en',
            locales: branch.site?.locales?.map((x) => x.locale) || [],
            branchId,
            modelId: chat?.modelId,
            modelProvider: chat?.modelProvider,
            onFinish: async ({ uiMessages, isAborted, model }) => {
                const previousMessages = await prisma.chatMessage.findMany({
                    where: { chatId },
                    orderBy: { index: 'asc' },
                })

                // First get previous chat data, then delete and recreate
                const prevChat = await prisma.chat.findFirst({
                    where: { chatId },
                })

                // Build operations array for transaction
                const operations: Prisma.PrismaPromise<any>[] = []
                // Delete existing chat (this will cascade delete related records)
                operations.push(
                    prisma.chat.deleteMany({
                        where: { chatId },
                    }),
                )

                // Create chat row
                operations.push(
                    prisma.chat.create({
                        data: {
                            chatId,
                            modelId: model.modelId,
                            modelProvider: model.provider,
                            createdAt: prevChat?.createdAt,
                            userId,
                            branchId,
                            currentSlug,
                            filesInDraft: (filesInDraft as any) || {},
                            lastPushedFiles: prevChat?.lastPushedFiles || {},
                            title: prevChat?.title,
                            prNumber: prevChat?.prNumber,
                            description: prevChat?.description,
                        },
                    }),
                )

                // Create message operations
                for (const [msgIdx, msg] of uiMessages.entries()) {
                    const parts = 'parts' in msg ? msg.parts || [] : []

                    if (msg.role !== 'assistant' && msg.role !== 'user') {
                        console.log(`ignoring message with role ${msg.role}`)
                        continue
                    }
                    const prevMessage = previousMessages.find(
                        (x) => x.id === msg.id,
                    )

                    // Add message create operation
                    operations.push(
                        prisma.chatMessage.create({
                            data: {
                                chatId,
                                id: msg.id,
                                createdAt: prevMessage?.createdAt || new Date(),
                                role: msg.role ?? 'user',
                                index: msgIdx,
                            },
                        }),
                    )

                    // Add part operations
                    for (const [index, part] of parts.entries()) {
                        // Handle only 'text', 'reasoning', and 'tool-invocation' types for now
                        if (part.type === 'text') {
                            // ChatMessagePart: { type: 'text', text: string }
                            operations.push(
                                prisma.chatPartText.create({
                                    data: {
                                        messageId: msg.id,
                                        type: 'text',
                                        index,
                                        text: part.text,
                                    },
                                }),
                            )
                        } else if (part.type === 'reasoning') {
                            // ChatMessagePart: { type: 'reasoning', text: string }

                            operations.push(
                                prisma.chatPartReasoning.create({
                                    data: {
                                        messageId: msg.id,
                                        type: 'reasoning',
                                        text: part.text,
                                        providerMetadata: part.providerMetadata,
                                        index,
                                    },
                                }),
                            )
                        } else if (isToolUIPart(part)) {
                            const { input, toolCallId } = part
                            if (part.state === 'output-available') {
                                operations.push(
                                    prisma.chatPartTool.create({
                                        data: {
                                            index,
                                            input: input as any,
                                            output: part.output as any,
                                            toolCallId,
                                            messageId: msg.id,
                                            state: part.state,
                                            type: part.type,
                                        },
                                    }),
                                )
                            } else if (part.state === 'output-error') {
                                operations.push(
                                    prisma.chatPartTool.create({
                                        data: {
                                            index,
                                            input: input as any,
                                            errorText: part.errorText,
                                            toolCallId,
                                            messageId: msg.id,
                                            state: part.state,
                                            type: part.type,
                                        },
                                    }),
                                )
                            } else {
                                console.log(
                                    `unhandled part tool type ${part.type} with state ${part.state}`,
                                )
                            }
                        } else if (part.type === 'file') {
                            // Handle ChatPartFile
                            operations.push(
                                prisma.chatPartFile.create({
                                    data: {
                                        messageId: msg.id,
                                        type: 'file',
                                        index,
                                        mediaType: part.mediaType,
                                        filename: part.filename,
                                        url: part.url,
                                    },
                                }),
                            )
                        } else if (part.type === 'source-url') {
                            // Handle ChatPartSourceUrl
                            operations.push(
                                prisma.chatPartSourceUrl.create({
                                    data: {
                                        messageId: msg.id,
                                        type: 'source-url',
                                        index,
                                        sourceId: part.sourceId,
                                        url: part.url,
                                        title: part.title,
                                        providerMetadata: part.providerMetadata,
                                    },
                                }),
                            )
                        } else {
                            console.log(
                                `skipping message of type ${part.type} in the database`,
                            )
                        }
                        // Ignore all other part types for now
                    }
                }

                // Execute all operations in a single transaction
                await prisma.$transaction(operations)
                waitUntil(
                    generateAndSaveChatTitle({
                        resultMessages: uiMessages,
                        chatId,
                        userId,
                    }).catch(notifyError),
                )
            },
        })
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
        return
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
        return pageWithContent?.content?.markdown || ''
    }
    return JSON.stringify(metaFile?.jsonData, null, 2) || ''
}

function debugMessages(allMessages: any[], filePath = 'scripts/messages.json') {
    return
    let combinedMessages = [...allMessages]
    if (fs.existsSync(filePath)) {
        try {
            const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'))
            if (Array.isArray(existing)) {
                combinedMessages = existing.concat(allMessages)
            }
        } catch (e) {
            // If error (invalid JSON), just use allMessages
        }
    }
    fs.writeFileSync(filePath, JSON.stringify(combinedMessages, null, 2))
}
