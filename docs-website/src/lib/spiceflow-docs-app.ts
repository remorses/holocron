import { OpenAIResponsesProviderOptions, openai } from '@ai-sdk/openai'
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
import { searchDocsWithTrieve } from './trieve-search'
import { getFumadocsSource } from './source'

const agentPromptTemplate = Handlebars.compile(agentPrompt)

// Tool input schemas
export const searchDocsInputSchema = z.object({
    query: z
        .string()
        .min(1)
        .describe('The search query to find relevant documentation content'),
})

export const goToPageInputSchema = z.object({
    slug: z
        .string()
        .describe(
            'The page slug/path to navigate to (e.g., "getting-started" or "api/authentication")',
        ),
})

export const getCurrentPageInputSchema = z
    .object({})
    .describe('Get the current page slug that the user is viewing')

export const fetchUrlInputSchema = z.object({
    url: z
        .string()
        .describe(
            'The URL to fetch. Can be a full URL (https://example.com) or a relative path (/docs/guide). For documentation pages, use .md extension (e.g., "/docs/getting-started.md") to fetch the markdown content.',
        ),
})

export const selectTextInputSchema = z.object({
    slug: z.string().describe('The page slug to navigate to and select text on'),
    startLine: z.number().describe('Starting line number to select (1-based)'),
    endLine: z.number().describe('Ending line number to select (1-based)'),
})

// Export types with capitalized names
export type SearchDocsInput = z.infer<typeof searchDocsInputSchema>
export type GoToPageInput = z.infer<typeof goToPageInputSchema>
export type GetCurrentPageInput = z.infer<typeof getCurrentPageInputSchema>
export type FetchUrlInput = z.infer<typeof fetchUrlInputSchema>
export type SelectTextInput = z.infer<typeof selectTextInputSchema>

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
        }),
        async *handler({ request, waitUntil, state: {} }) {
            const { messages, currentSlug, locale, chatId, currentOrigin } =
                await request.json()
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
                githubFolder: siteBranch.site?.githubFolder || '',
            })
            const source = getFumadocsSource({
                files,
                defaultLanguage,
                languages,
            })
            const pages = source.getPages(locale)

            let model = openai.responses('gpt-4.1')

            const linksText = pages
                .map((page) => {
                    const title = page.data.title || 'Untitled'
                    const url = `${page.url}.md`
                    return `- [${title}](${url}) // ${page.data.description}`
                })
                .join('\n')
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
                    } satisfies OpenAIResponsesProviderOptions,
                },
                tools: {
                    searchDocs: tool({
                        inputSchema: searchDocsInputSchema,
                        execute: async ({ query }) => {
                            let tag = ''
                            const results = await searchDocsWithTrieve({
                                trieveDatasetId: siteBranch.trieveDatasetId,
                                query,
                                tag,
                            })
                            return results
                        },
                    }),
                    goToPage: tool({
                        inputSchema: goToPageInputSchema,
                        execute: async ({ slug }) => {
                            const slugParts = slug.split('/').filter(Boolean)
                            const page = source.getPage(slugParts)
                            if (!page) {
                                return `page ${slug} not found`
                            }
                            return `went to page ${slug}`
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
                            // if (endLine - startLine + 1 > maxLines) {
                            //     return `Cannot select more than 10 lines of text. You requested ${endLine - startLine + 1} lines.`
                            // }

                            const slugParts = slug.split('/').filter(Boolean)
                            const page = source.getPage(slugParts)
                            if (!page) {
                                return `Page ${slug} not found`
                            }

                            return `Text selection will be highlighted on page ${slug} from line ${startLine} to ${endLine}`
                        },
                    }),
                },
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
