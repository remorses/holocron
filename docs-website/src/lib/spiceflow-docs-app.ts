import { anthropic } from '@ai-sdk/anthropic'
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
import { docsJsonSchema } from 'docs-website/src/lib/docs-json'
import { processMdxInServer } from 'docs-website/src/lib/mdx.server'
import Handlebars from 'handlebars'
import path from 'path'
import { Spiceflow } from 'spiceflow'
import z from 'zod'
import agentPrompt from '../prompts/docs-agent.md?raw'

import { notifyError } from './errors'
import { createTokenizer } from '@orama/tokenizers/mandarin'
import { createI18nSearchAPI } from 'fumadocs-core/search/server'
import { getFilesForSource, getFumadocsSource } from './source.server'
import { searchDocsWithTrieve } from './trieve-search'

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

            const defaultLocale = site?.defaultLocale
            const locales = site?.locales?.map((x) => x.locale)
            const files = await getFilesForSource({
                branchId: siteBranch.branchId,
                githubFolder: siteBranch.site?.githubFolder || '',
            })
            const source = getFumadocsSource({ files, defaultLocale, locales })
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
                    search_docs: tool({
                        parameters: z.object({
                            query: z
                                .string()
                                .min(1)
                                .describe('The search query'),
                        }),
                        async execute({ query }) {
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
                        parameters: z.object({
                            slug: z.string().describe('The page slug'),
                        }),
                        async execute({ slug }) {
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
    .onError(({ error }) => {
        notifyError(error)
    })
