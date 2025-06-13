import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import { coreMessageSchema, streamText, tool, UIMessage } from 'ai'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { notifyError } from './errors'
import { s3 } from './s3'
import { env } from './env'
import { pagesFromGithub, syncSite } from './sync'
import { prisma } from 'db'
import { getSession } from './better-auth'

// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow({ basePath: '/api' })
    // Health check endpoint
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
            const result = streamText({
                model: openai.responses('gpt-4.1-nano'),
                messages,
                maxSteps: 100,
                experimental_providerMetadata: {
                    openai: {
                        reasoningSummary: 'detailed',
                    } satisfies OpenAIResponsesProviderOptions,
                },
                tools: {
                    getWeather: tool({
                        description:
                            'Get current weather information for a location',
                        parameters: z.object({
                            location: z
                                .string()
                                .describe(
                                    'The city and state/country to get weather for',
                                ),
                        }),
                        execute: async ({ location }) => {
                            // Mock weather data - in a real app you'd call a weather API
                            const weatherData = {
                                location,
                                temperature:
                                    Math.floor(Math.random() * 30) + 10,
                                condition: [
                                    'sunny',
                                    'cloudy',
                                    'rainy',
                                    'snowy',
                                ][Math.floor(Math.random() * 4)],
                                humidity: Math.floor(Math.random() * 50) + 30,
                            }
                            return `Weather in ${location}: ${weatherData.temperature}°C, ${weatherData.condition}, ${weatherData.humidity}% humidity`
                        },
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
            tabId: z.string().min(1, 'tabId is required'),
        }),
        async handler({ request, state }) {
            const { userId } = await getSession({ request })
            const { siteId, tabId } = await request.json()

            if (!userId) {
                throw new Error('Missing x-user-id header')
            }
            const site = await prisma.site.findFirst({
                where: { siteId, org: { users: { some: { userId } } } },
                include: {

                }
            })
            if (!site) {
                throw new Error('Site not found for this user')
            }
            const orgId = site.orgId
            const name = site.name
            const pages = pagesFromGithub({
                installationId: site.installationId,
                owner: site.githubOwner,
                repo: site.githubRepo,
                signal: request.signal,
            })
            await syncSite({
                orgId,
                siteId,
                tabId,
                name: site.name || '',
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
    .route({
        method: 'POST',
        path: '/createUploadSignedUrl',
        request: z.object({
            key: z.string().min(1, 'Key is required'),
            contentType: z.string().optional(),
        }),
        async handler({ request }) {
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
    // Error handling middleware
    .onError(({ error }) => {
        notifyError(error)
    })

export type SpiceflowApp = typeof app
