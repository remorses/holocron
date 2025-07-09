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

export const docsApp = new Spiceflow({ basePath: '/api' })
    .route({
        method: 'POST',
        path: '/generateMessage',
        request: z.object({
            messages: z.array(z.custom<UIMessage>()),
            chatId: z.string(),
            locale: z.string(),
            currentSlug: z.string(),
        }),
        async *handler({ request, waitUntil, state: {} }) {
            const { messages, currentSlug, locale, chatId } =
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
                    search_docs: tool({
                        inputSchema: z.object({
                            query: z
                                .string()
                                .min(1)
                                .describe('The search query'),
                        }),
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
                    go_to_page: tool({
                        inputSchema: z.object({
                            slug: z.string().describe('The page slug'),
                        }),
                        execute: async ({ slug }) => {
                            const slugParts = slug.split('/').filter(Boolean)
                            const page = source.getPage(slugParts)
                            if (!page) {
                                return `page ${slug} not found`
                            }
                            return `went to page ${slug}`
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
