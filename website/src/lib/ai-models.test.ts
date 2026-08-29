import { describe, expect, test } from 'vitest'
import { ALLOWED_MODELS, MODEL_USD_PER_1M_TOKENS, buildUpstreamChatBody, resolveAllowedModel } from './ai-models.ts'

describe('buildUpstreamChatBody', () => {
  test('drops gateway routing fields that would pick another model', () => {
    expect(buildUpstreamChatBody({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'anthropic/claude-opus-5',
      models: ['anthropic/claude-opus-5'],
      provider: { sort: 'cost' },
      providerOptions: { gateway: { byok: { anthropic: [{ apiKey: 'sk-x' }] } } },
      n: 8,
      stream: true,
    })).toMatchInlineSnapshot(`
      {
        "body": {
          "max_tokens": 16000,
          "messages": [
            {
              "content": "hi",
              "role": "user",
            },
          ],
          "model": "deepseek/deepseek-v4-flash",
          "stream": true,
          "stream_options": {
            "include_usage": true,
          },
        },
        "friendlyModel": "deepseek-v4-flash",
        "stream": true,
      }
    `)
  })

  test('accepts an allowed friendly name', () => {
    const result = buildUpstreamChatBody({ model: 'glm-5.3-flash', messages: [] })
    expect(result.friendlyModel).toBe('glm-5.3-flash')
    expect(result.body.model).toBe('zai/glm-5.3-flash')
  })

  test('clamps max_tokens', () => {
    expect(buildUpstreamChatBody({ max_tokens: 1_000_000 }).body.max_tokens).toBe(16000)
    expect(buildUpstreamChatBody({ max_tokens: 0 }).body.max_tokens).toBe(1)
  })
})

describe('ALLOWED_MODELS', () => {
  test('every model has a rate', () => {
    for (const name of Object.keys(ALLOWED_MODELS)) {
      expect(MODEL_USD_PER_1M_TOKENS[name], name).toBeDefined()
    }
  })

  test('unknown names fall back to the default', () => {
    expect(resolveAllowedModel('nope')).toBe('deepseek-v4-flash')
    expect(resolveAllowedModel('zai/glm-5.3-flash')).toBe('glm-5.3-flash')
  })
})
