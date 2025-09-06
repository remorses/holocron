import { describe, it, expect } from 'vitest'
import { DocsConfigSchema } from './docs-json'
import { streamObject, streamText, wrapLanguageModel } from 'ai'
import { openai } from '@ai-sdk/openai'
import { createAiCacheMiddleware } from 'contesto/src/lib/ai-cache.js'

describe.skip(
  'AI-generated example for DocsConfigSchema',
  () => {
    it('should generate an example schema and match snapshot', async () => {
      // Create a system prompt to describe the task
      const systemPrompt = `
      Given the following zod schema (Typescript code), create a JSON object that validates against it.
      Only provide the JSON, no explanation.
      ---
      ${DocsConfigSchema.toString()}
    `

      const middleware = createAiCacheMiddleware({})

      const model = wrapLanguageModel({
        model: openai('gpt-4o-mini'),
        middleware: [middleware],
      })
      // Use streamText v4 API, do not use a string for the model field
      const aiStream = await streamObject({
        model,
        system: systemPrompt,
        schema: DocsConfigSchema,
        messages: [
          {
            role: 'user',
            content: 'Generate an example json object for this schema that showcases the schema features',
          },
        ],
        temperature: 0.2,
      })

      // streamText returns an async iterable v4, so we accumulate all chunks
      let aiResultText = ''
      for await (const chunk of aiStream.textStream) {
        aiResultText += chunk
        process.stdout.write(chunk)
      }

      expect(await aiStream.object).toMatchSnapshot()
    })
  },
  1000 * 20,
)
