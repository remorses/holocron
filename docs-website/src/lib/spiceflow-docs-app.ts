import { OpenAIResponsesProviderOptions, openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import {
    UIMessage,
    streamText,
    tool,
    stepCountIs,
    convertToModelMessages,
} from 'ai'
import { prisma } from 'db'
import Handlebars from 'handlebars'
import { Spiceflow } from 'spiceflow'
import z from 'zod'
import agentPrompt from '../prompts/docs-agent.md?raw'
import { readableStreamToAsyncIterable } from 'contesto/src/lib/utils'

import { notifyError } from './errors'
import { getFilesForSource } from './source.server'
import {
    searchDocsWithTrieve,
    formatTrieveSearchResults,
} from './trieve-search'
import { getFumadocsSource } from './source'
import {
    searchDocsInputSchema,
    goToPageInputSchema,
    getCurrentPageInputSchema,
    fetchUrlInputSchema,
    selectTextInputSchema,
    type SearchDocsInput,
    type GoToPageInput,
    type GetCurrentPageInput,
    type FetchUrlInput,
    type SelectTextInput,
} from 'website/src/lib/shared-docs-tools'
import { cleanSlug } from './slug-utils'
import {
    createEditTool,
    editToolParamsSchema,
    fileUpdateSchema,
    type FileUpdate,
} from './edit-tool'
import { FileSystemEmulator } from 'website/src/lib/file-system-emulator'

const agentPromptTemplate = Handlebars.compile(agentPrompt)

export const docsApp = new Spiceflow({ basePath: '/api' })
    .route({
        method: 'POST',
        path: '/generateMessage',
        request: z.object({
            messages: z.array(z.custom<UIMessage>()),
            chatId: z.string(),
            locale: z.string(),
            currentSlug: z.string(),
            currentOrigin: z.string(),
            filesInDraft: z
                .record(z.string(), fileUpdateSchema)
                .optional()
                .default({}),
        }),
        async *handler({ request, waitUntil, state: {} }) {
            const {
                messages,
                currentSlug,
                locale,
                chatId,
                currentOrigin,
                filesInDraft = {},
            } = await request.json()
            const url = new URL(request.url)
            const domain = url.hostname.split(':')[0]

            const siteBranch = await prisma.siteBranch.findFirst({
                where: {
                    domains: {
                        some: {
                            host: domain,
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
            })

            const site = siteBranch?.site
            const branchId = siteBranch?.branchId

            if (!branchId) {
                throw new Response('Branch not found', { status: 404 })
            }

            const defaultLanguage = site?.defaultLocale || 'en'
            const languages = site?.locales?.map((x) => x.locale) || []
            const files = await getFilesForSource({
                branchId: siteBranch.branchId,
                filesInDraft,
                githubFolder: siteBranch.site?.githubFolder || '',
            })
            const source = getFumadocsSource({
                files,
                defaultLanguage,
                languages,
            })
            const pages = source.getPages(locale)

            // let model = openai.responses('gpt-4.1')
            let model = anthropic('claude-3-5-haiku-latest')

            const linksText = pages
                .map((page) => {
                    const title = page.data.title || 'Untitled'
                    const url = `${page.url}.md`
                    return `- [${title}](${url}) // ${page.data.description}`
                })
                .join('\n')

            // Create FileSystemEmulator instance
            const fileSystem = new FileSystemEmulator({
                filesInDraft,
                getPageContent: async (githubPathWrong) => {
                    const slug = cleanSlug(githubPathWrong)
                    const sourcePage = source.getPage(
                        slug.split('/').filter(Boolean),
                    )
                    const githubPath = sourcePage?.file.path || ''
                    if (!githubPath) {
                        const error = new Error(
                            `File not found for slug: ${slug}`,
                        )
                        console.error(error)
                        throw error
                    }
                    if (githubPath !== githubPathWrong) {
                        throw new Error(
                            `the canonical path of ${githubPathWrong} is ${githubPath}, please call again the tool using ${githubPath} instead`,
                        )
                    }

                    // Otherwise, try to get content from database
                    const [page, metaFile] = await Promise.all([
                        prisma.markdownPage.findFirst({
                            where: {
                                branchId: siteBranch.branchId,
                                githubPath: githubPath,
                            },
                            include: {
                                content: true,
                            },
                        }),
                        prisma.metaFile.findFirst({
                            where: {
                                branchId: siteBranch.branchId,
                                githubPath: githubPath,
                            },
                        }),
                    ])

                    if (page?.content?.markdown) {
                        return page.content.markdown
                    }

                    if (metaFile?.jsonData) {
                        return JSON.stringify(
                            metaFile.jsonData,
                            null,
                            2,
                        )
                    }

                    const error = new Error(
                        `File ${githubPath} not found in draft or database`,
                    )
                    console.error(error)
                    throw error
                },
            })

            const editTool = createEditTool({
                fileSystem,
                model: { provider: model.provider },
            })

            const tools: Record<string, any> = {
              strReplaceEditor: editTool,
                searchDocs: tool({
                    inputSchema: searchDocsInputSchema,
                    execute: async ({ terms, searchType = 'fulltext' }) => {
                        let tag = ''
                        const results = await searchDocsWithTrieve({
                            trieveDatasetId: siteBranch.trieveDatasetId,
                            query: terms,
                            tag,
                            searchType,
                        })
                        return formatTrieveSearchResults({
                            results,
                            baseUrl: currentOrigin,
                        })
                    },
                }),
                goToPage: tool({
                    inputSchema: goToPageInputSchema,
                    execute: async ({ slug: _slug }) => {
                        const cleanedSlug = cleanSlug(_slug)
                        const slugParts = cleanedSlug.split('/').filter(Boolean)
                        const page = source.getPage(slugParts)
                        if (!page) {
                            return { error: `page ${cleanedSlug} not found` }
                        }
                        return {
                            slug: page.url,
                            message: `Navigating to ${page.url}`,
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
                    inputSchema: fetchUrlInputSchema,
                    execute: async ({ url }) => {
                            let fullUrl: string
                            if (
                                url.startsWith('http://') ||
                                url.startsWith('https://')
                            ) {
                                fullUrl = url
                            } else {
                                // If only path is provided, use current origin as base
                                fullUrl = new URL(url, currentOrigin).toString()
                            }

                            try {
                                console.log(`Fetching URL: ${fullUrl}`)

                                const response = await fetch(fullUrl)
                                if (!response.ok) {
                                    console.log(
                                        `Failed to fetch ${fullUrl}: ${response.status} ${response.statusText}`,
                                    )
                                    return `Failed to fetch ${fullUrl}: ${response.status} ${response.statusText}`
                                }

                                const contentType =
                                    response.headers.get('content-type') || ''
                                console.log(`Content type: ${contentType}`)

                                if (contentType.includes('application/json')) {
                                    const data = await response.json()
                                    return JSON.stringify(data, null, 2)
                                } else if (contentType.includes('text/html')) {
                                    const html = await response.text()
                                    // Return first 2000 characters to avoid overwhelming context
                                    return html.length > 2000
                                        ? html.substring(0, 2000) + '...'
                                        : html
                                } else {
                                    const text = await response.text()
                                    return text.length > 2000
                                        ? text.substring(0, 2000) + '...'
                                        : text
                                }
                            } catch (error) {
                                console.log(
                                    `Error fetching ${fullUrl} ${error.message}`,
                                )
                                return `Error fetching ${url}: ${error.message}`
                            }
                        },
                    }),
                selectText: tool({
                    inputSchema: selectTextInputSchema,
                    execute: async ({ slug, startLine, endLine }) => {
                        // Clean the slug using the utility function
                        const cleanedSlug = cleanSlug(slug)

                        // if (endLine - startLine + 1 > maxLines) {
                        //     return { error: `Cannot select more than 10 lines of text. You requested ${endLine - startLine + 1} lines.` }
                        // }

                        const slugParts = cleanedSlug
                            .split('/')
                            .filter(Boolean)
                        const page = source.getPage(slugParts)
                        if (!page) {
                            return {
                                error: `Page ${cleanedSlug} not found`,
                            }
                        }

                        return {
                            slug: page.url,
                            startLine,
                            endLine,
                            message: `highlighted text on ${page.url} from ${startLine} to ${endLine}`,
                        }
                    },
                }),
            }

            // Add edit tool


            const result = streamText({
                model,
                messages: [
                    {
                        role: 'system',
                        content: agentPromptTemplate({ linksText }),
                    },
                    ...convertToModelMessages(
                        messages.filter((x) => x.role !== 'system'),
                    ),
                ],
                stopWhen: stepCountIs(100),
                providerOptions: {
                    openai: {
                        reasoningSummary: 'detailed',
                        strictJsonSchema: true,
                    } satisfies OpenAIResponsesProviderOptions,
                },
                tools,
                async onFinish({ response }) {},
            })

            const lastUserMessage = messages.findLast((x) => x.role === 'user')

            yield* readableStreamToAsyncIterable(
                result.toUIMessageStream({ originalMessages: messages }),
            )
        },
    })
    .onError(({ error }) => {
        notifyError(error)
    })

export type DocsSpiceflowApp = typeof docsApp
