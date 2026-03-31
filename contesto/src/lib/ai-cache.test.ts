import { createOpenAI } from '@ai-sdk/openai'
import stableString from 'fast-json-stable-stringify'
import { streamText, generateText, generateObject, wrapLanguageModel } from 'ai'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createAiCacheMiddleware } from './ai-cache'

describe(
  'ai-cache middleware',
  () => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error(`missing OPENAI_API_KEY`)
    const openai = createOpenAI({ apiKey })

    it('should cache and return the same result for identical requests', async () => {
      const middleware = createAiCacheMiddleware({})

      const model = wrapLanguageModel({
        model: openai('gpt-5-mini'),
        middleware: [middleware],
      })
      const res = streamText({
        model,
        temperature: 1,
        prompt: 'Generate a simple very short story',
      })
      await res.consumeStream()
      const text = await res.text
      expect(text).toMatchInlineSnapshot(
        `"Lina found a small paper boat on the windowsill and set it in a puddle after the rain. She watched it drift past fallen leaves and a bright yellow dandelion. A gentle breeze nudged the boat toward the garden gate, where a kind neighbor scooped it up and smiled. Lina waved, feeling like the whole world had made room for one tiny adventure."`,
      )
    })

    it('should cache and return the same result for generateText', async () => {
      const middleware = createAiCacheMiddleware({})

      const model = wrapLanguageModel({
        model: openai('gpt-5-mini'),
        middleware: [middleware],
      })

      const result = await generateText({
        model,
        temperature: 1,
        prompt: 'What is the capital of France?',
      })

      expect(result.text).toMatchInlineSnapshot(`"The capital of France is Paris."`)
    })

    it('should cache and return the same result for generateObject', async () => {
      let params: any
      const middleware = createAiCacheMiddleware({
        onParams(x) {
          params = x
        },
      })

      const model = wrapLanguageModel({
        model: openai('gpt-5-mini'),
        middleware: [middleware],
      })

      const schema = z.object({
        name: z.string(),
        age: z.number(),
        occupation: z.string(),
      })

      const result = await generateObject({
        model,
        temperature: 1,
        schema,
        prompt:
          'Generate information about a software engineer named John who is 30 years old, very long one with super long names',
      })
      expect(stableString(params)).toMatchInlineSnapshot(
        `"{"headers":{"user-agent":"ai/6.0.142"},"prompt":[{"content":[{"text":"Generate information about a software engineer named John who is 30 years old, very long one with super long names","type":"text"}],"role":"user"}],"responseFormat":{"schema":{"$schema":"http://json-schema.org/draft-07/schema#","additionalProperties":false,"properties":{"age":{"type":"number"},"name":{"type":"string"},"occupation":{"type":"string"}},"required":["name","age","occupation"],"type":"object"},"type":"json"},"temperature":1}"`,
      )

      expect(result.object).toMatchInlineSnapshot(`
        {
          "age": 30,
          "name": "John Alexander Benjamin Christopher Daniel Edward Frederick Gregory Harrison Ignatius Jeremiah Konstantin Leopold Montgomery Nathaniel Oliver Percival Quentin Reginald Sebastian Thaddeus Ulysses Victor Winston Xavier Yves Zachary-Alexei-Balthazar-Cassius-Donovan-Ezekiel-Fitzgerald-Galileo-Hamilton-Ibrahim-Joaquin-Kai-Laurent-Marian-Nikolai-Orlando-Peregrine-Quincy-Raffaello-Salvatore-Theodore-Ulrich-Vladimir-Willoughby-Xander-Yorick-Zadkiel",
          "occupation": "Software Engineer",
        }
      `)
    })

    it('should return cached result on second call', async () => {
      const middleware = createAiCacheMiddleware({})

      const model = wrapLanguageModel({
        model: openai('gpt-5-mini'),
        middleware: [middleware],
      })

      const prompt = 'What is 2+2?'

      // First call - should make actual API call
      const result1 = await generateText({
        model,
        temperature: 0,
        prompt,
      })

      // Second call - should use cache
      const result2 = await generateText({
        model,
        temperature: 0,
        prompt,
      })

      // Both results should be identical
      expect(result1.text).toBe(result2.text)
      expect(result1.text).toMatchInlineSnapshot(`"2 + 2 = 4"`)
    })
  },
  1000 * 10,
)
