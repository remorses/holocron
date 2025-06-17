import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { openapi } from 'spiceflow/openapi'
import { coreMessageSchema, streamText, tool, UIMessage } from 'ai'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { notifyError } from './errors'
import { s3 } from 'docs-website/src/lib/s3'
import { env } from './env'
import { pagesFromGithub, syncSite } from './sync'
import { prisma } from 'db'
import { auth, getSession } from './better-auth'
import { sleep } from './utils'
import { EditToolParamSchema, editToolParamsSchema } from './schemas'

function createEditTool({
    updatedPages,
    modelId,
}: {
    modelId: string
    updatedPages: Record<string, PageUpdate>
}) {
    const previousEdits: PageUpdate[] = []
    async function execute(params: EditToolParamSchema) {
        const {
            command,
            path,
            file_text,
            insert_line,
            new_str,
            old_str,
            view_range,
        } = params

        switch (command) {
            case 'view': {
                const override = updatedPages[path]
                let content: string | null = null

                if (override) {
                    content = override.markdown
                } else {
                    const page = await prisma.markdownPage.findFirst({
                        where: {
                            githubPath: path,
                        },
                    })
                    if (!page) {
                        return {
                            success: false,
                            error: `Cannot find page with path ${path}`,
                        }
                    }
                    content = page.markdown
                }

                if (
                    view_range &&
                    Array.isArray(view_range) &&
                    view_range.length === 2 &&
                    content
                ) {
                    const [start, end] = view_range
                    const lines = content.split('\n')
                    const startIdx = Math.max(start - 1, 0)
                    const endIdx =
                        end === -1 ? lines.length : Math.min(end, lines.length)
                    return lines.slice(startIdx, endIdx).join('\n')
                }

                return content
            }
            case 'create': {
                if (!file_text) {
                    return {
                        success: false,
                        error: '`file_text` is required for create command.',
                    }
                }
                updatedPages[path] = {
                    githubPath: path,
                    markdown: file_text,
                }
                return file_text
            }
            case 'str_replace': {
                const override = updatedPages[path]
                if (!override) {
                    return {
                        success: false,
                        error: `Page not found for path: ${path}`,
                    }
                }
                
                // Store current state before editing
                previousEdits.push({
                    githubPath: path,
                    markdown: override.markdown,
                })
                if (typeof old_str !== 'string' || old_str.length === 0) {
                    return {
                        success: false,
                        error: '`old_str` is required for str_replace command.',
                    }
                }
                if (typeof new_str !== 'string') {
                    return {
                        success: false,
                        error: '`new_str` is required for str_replace command.',
                    }
                }
                const occurrences = override.markdown.split(old_str).length - 1
                if (occurrences === 0) {
                    return {
                        success: false,
                        error: `No match found for replacement. Old string "${old_str}" not found in the document.`,
                    }
                }
                if (occurrences > 1) {
                    return {
                        success: false,
                        error: `Old string "${old_str}" found more than once in the document.`,
                    }
                }
                const replacedContent = override.markdown.replace(
                    old_str,
                    new_str,
                )
                updatedPages[path] = {
                    githubPath: path,
                    markdown: replacedContent,
                }
                return replacedContent
            }
            case 'insert': {
                const override = updatedPages[path]
                if (!override) {
                    return {
                        success: false,
                        error: `Page not found for path: ${path}`,
                    }
                }
                
                // Store current state before editing
                previousEdits.push({
                    githubPath: path,
                    markdown: override.markdown,
                })
                if (typeof insert_line !== 'number' || insert_line < 1) {
                    return {
                        success: false,
                        error: '`insert_line` (must be >= 1) is required for insert command.',
                    }
                }
                if (typeof new_str !== 'string') {
                    return {
                        success: false,
                        error: '`new_str` is required for insert command.',
                    }
                }
                const lines = override.markdown.split('\n')
                // insert_line is 1-based, insert after the specified line
                const insertAt = Math.min(insert_line, lines.length)
                lines.splice(insertAt, 0, new_str)
                const newContent = lines.join('\n')
                updatedPages[path] = {
                    githubPath: path,
                    markdown: newContent,
                }
                return newContent
            }
            case 'undo_edit': {
                const previous = previousEdits.pop()
                if (!previous) {
                    return {
                        success: false,
                        error: `No previous edit found for path: ${path}. Cannot undo.`,
                    }
                }
                
                // Restore the previous content
                updatedPages[path] = {
                    githubPath: path,
                    markdown: previous.markdown,
                }
                
                return {
                    success: true,
                    message: `Successfully reverted ${path} to previous state.`,
                    content: previous.markdown,
                }
            }
            default: {
                return {
                    success: false,
                    error: `Unknown command: ${command}`,
                }
            }
        }
    }
    if (modelId.includes('anthropic')) {
        return anthropic.tools.textEditor_20241022({
            execute: execute as any,
        })
    }
    return tool({
        parameters: editToolParamsSchema,
        execute,

        // description: `Edit contents of a file`,
    })
}

export type PageUpdate = { githubPath: string; markdown: string }

// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow({ basePath: '/api' })
    // .state('env', {} as Env)
    // Health check endpoint
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
        path: '/generateMessage',
        request: z.object({
            messages: z.array(z.custom<UIMessage>()),
        }),
        async *handler({ request }) {
            const { messages } = await request.json()
            await sleep(1000)
            const updatedPages: Record<string, PageUpdate> = {}
            const model = openai.responses('gpt-4.1-nano')
            const result = streamText({
                model,
                messages,
                maxSteps: 100,
                experimental_providerMetadata: {
                    openai: {
                        reasoningSummary: 'detailed',
                    } satisfies OpenAIResponsesProviderOptions,
                },
                toolCallStreaming: true,
                tools: {
                    str_replace_editor: createEditTool({
                        updatedPages,
                        modelId: model.modelId,
                    }),
                },
                async onFinish({ response }) {},
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
