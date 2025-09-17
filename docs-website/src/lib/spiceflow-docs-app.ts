import { OpenAIResponsesProviderOptions, openai } from '@ai-sdk/openai'
import { fireworks } from '@ai-sdk/fireworks';
import { LanguageModelV2, type LanguageModelV2Middleware } from '@ai-sdk/provider'
import { google, } from '@ai-sdk/google'
import dedent from 'string-dedent'
import { anthropic } from '@ai-sdk/anthropic'
import { groq } from '@ai-sdk/groq'
import { createFallback } from 'ai-fallback'
import { UIMessage, streamText, tool, stepCountIs, convertToModelMessages, smoothStream, LanguageModel } from 'ai'
import { prisma } from 'db'
import Handlebars from 'handlebars'
import { Spiceflow } from 'spiceflow'
import z from 'zod'
import agentPrompt from '../prompts/docs-agent.md?raw'
import { readableStreamToAsyncIterable } from 'contesto/src/lib/utils'
import { preventProcessExitIfBusy } from 'spiceflow'
import { notifyError } from './errors'
import { getFilesForSource } from './source.server'
import { searchDocsWithSearchApi, formatSearchApiSearchResults } from './search-api-search'
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
import { createEditTool, editToolParamsSchema, fileUpdateSchema, type FileUpdate } from './edit-tool'
import { FileSystemEmulator } from 'website/src/lib/file-system-emulator'
import { printDirectoryTree } from './directory-tree'
import { createInvalidTool, INVALID_TOOL_NAME } from 'contesto/src/lib/invalid-tool'
import { getHost } from './get-host'
import { moonshot } from './moonshot';

const agentPromptTemplate = Handlebars.compile(agentPrompt)

// Create fallback model with groq as primary and gemini flash 2.5 as fallback
let model: LanguageModelV2 = createFallback({
  models: [
    // groq('moonshotai/kimi-k2-instruct-0905'),
    moonshot('kimi-k2-0905-preview'),
    google('gemini-2.5-flash'),
  ],
  onError: (error, modelId) => {
    console.error(`Error with model ${modelId}:`, error)
    notifyError(error, `AI fallback for: ${modelId}`)
  },
  modelResetInterval: 60000, // Reset to primary model after 1 minute
})

export const docsApp = new Spiceflow({ basePath: '/holocronInternalAPI' })
  .use(preventProcessExitIfBusy())
  .route({
    method: 'POST',
    path: '/generateMessage',
    request: z.object({
      messages: z.array(z.custom<UIMessage>()),
      chatId: z.string(),
      locale: z.string(),
      currentSlug: z.string(),
      currentOrigin: z.string(),
      filesInDraft: z.record(z.string(), fileUpdateSchema).optional().default({}),
    }),
    async *handler({ request, waitUntil, state: { } }) {
      const { messages, currentSlug, locale, chatId, currentOrigin, filesInDraft = {} } = await request.json()
      const domain = getHost(request)

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
          const sourcePage = source.getPage(slug.split('/').filter(Boolean))
          const githubPath = sourcePage?.file.path || ''
          if (!githubPath) {
            const error = new Error(`File not found for slug: ${slug}`)
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
            return JSON.stringify(metaFile.jsonData, null, 2)
          }

          const error = new Error(`File ${githubPath} not found in draft or database`)
          console.error(error)
          throw error
        },
      })

      const { invalidTool, repairToolCall } = createInvalidTool({})

      const editTool = createEditTool({
        fileSystem,
        model: { provider: model.provider },
      })

      const tools = {
        strReplaceEditor: editTool,
        invalidTool,
        searchDocs: tool({
          inputSchema: searchDocsInputSchema,
          execute: async ({ terms, searchType = 'fulltext' }) => {
            let tag = ''
            const results = await searchDocsWithSearchApi({
              branchId: branchId,
              query: terms,
            })
            return formatSearchApiSearchResults({
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
        fetch: tool({
          inputSchema: fetchUrlInputSchema,
          execute: async ({ url }) => {
            let fullUrl: string
            if (url.startsWith('http://') || url.startsWith('https://')) {
              fullUrl = url
            } else {
              // If only path is provided, use current origin as base
              fullUrl = new URL(url, currentOrigin).toString()
            }

            try {
              console.log(`Fetching URL: ${fullUrl}`)

              const response = await fetch(fullUrl)
              if (!response.ok) {
                console.log(`Failed to fetch ${fullUrl}: ${response.status} ${response.statusText}`)
                return `Failed to fetch ${fullUrl}: ${response.status} ${response.statusText}`
              }

              const contentType = response.headers.get('content-type') || ''
              console.log(`Content type: ${contentType}`)

              if (contentType.includes('application/json')) {
                const data = await response.json()
                return JSON.stringify(data, null, 2)
              } else if (contentType.includes('text/html')) {
                const html = await response.text()
                // Return first 2000 characters to avoid overwhelming context
                return html.length > 2000 ? html.substring(0, 2000) + '...' : html
              } else {
                const text = await response.text()
                return text.length > 2000 ? text.substring(0, 2000) + '...' : text
              }
            } catch (error) {
              console.log(`Error fetching ${fullUrl} ${error.message}`)
              return `Error fetching ${url}: ${error.message}`
            }
          },
        }),
        getProjectFiles: tool({
          description: dedent`
                      Returns a directory tree diagram of the current project files as plain text.
                      Useful for giving an overview or locating files.
                      If user asks to get project structure or files always call this tool instead of using your knowledge.
                  `,
          inputSchema: z.object({}),
          execute: async () => {
            const filePaths = [...files].map((x) => {
              const title = x.data?.title || ''
              const p = x.path || ''
              return {
                path: p,
                title,
              }
            })

            return printDirectoryTree({
              filePaths,
            })
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

                    NEVER select the first heading of the page. The first \`# heading\` will be removed from the page.
                    `,
          execute: async ({ slug, startLine, endLine }) => {
            // Clean the slug using the utility function
            const cleanedSlug = cleanSlug(slug)

            // if (endLine - startLine + 1 > maxLines) {
            //     return { error: `Cannot select more than 10 lines of text. You requested ${endLine - startLine + 1} lines.` }
            // }

            const slugParts = cleanedSlug.split('/').filter(Boolean)
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
        experimental_transform: smoothStream({
          delayInMs: 7,
          chunking: 'word',
        }),
        messages: [
          {
            role: 'system',
            content: agentPromptTemplate({ linksText }),
          },
          ...convertToModelMessages(messages.filter((x) => x.role !== 'system')),
        ],
        async experimental_repairToolCall(input) {
          return repairToolCall(input)
        },
        stopWhen: stepCountIs(100),
        providerOptions: {
          openai: {
            reasoningSummary: 'detailed',
            strictJsonSchema: true,
          } satisfies OpenAIResponsesProviderOptions,
        },
        tools,
        async onFinish({ response }) { },
      })

      const lastUserMessage = messages.findLast((x) => x.role === 'user')

      yield* readableStreamToAsyncIterable(result.toUIMessageStream({ originalMessages: messages }))
    },
  })
  .onError(({ error }) => {
    notifyError(error)
  })

export type DocsSpiceflowApp = typeof docsApp
