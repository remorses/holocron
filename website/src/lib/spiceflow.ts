import { openai, OpenAIResponsesProviderOptions } from '@ai-sdk/openai'
import { coreMessageSchema, streamText, tool, UIMessage } from 'ai'
import { Spiceflow } from 'spiceflow'
import { z } from 'zod'
import { notifyError } from './errors'
import { s3 } from './s3'

// Create the main spiceflow app with comprehensive routes and features
export const app = new Spiceflow({ basePath: '/api' })
    // Health check endpoint
    .get('/health', () => ({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    }))
    .post(
        '/generateMessage',
        async function* generator({ request }) {
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
        {
            body: z.object({
                messages: z.array(z.custom<UIMessage>()),
            }),
        },
    )
    .post(
        '/createUploadSignedUrl',

        async ({ request }) => {
            const body = await request.json()

            const signedUrl = s3.presign(body.key, {
                method: 'PUT',
            })

            return {
                success: true,
                signedUrl,
            }
        },
        {
            body: z.object({
                key: z.string().min(1, 'Key is required'),
                contentType: z.string().optional(),
            }),
        },
    )
    // Error handling middleware
    .onError(({ error }) => {
        notifyError(error)
    })

export type SpiceflowApp = typeof app
