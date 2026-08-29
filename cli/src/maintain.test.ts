// Tests Maintain --model parsing for Holocron-hosted vs OpenCode BYOK ids.

import { describe, expect, test } from 'vitest'
import { parseMaintainModel } from './maintain.ts'

describe('parseMaintainModel', () => {
  test('defaults to a Holocron-hosted model', () => {
    expect(parseMaintainModel()).toMatchInlineSnapshot(`
      {
        "kind": "hosted",
      }
    `)
  })

  test('treats a bare Holocron model id as hosted', () => {
    expect(parseMaintainModel('glm-5.3-flash')).toMatchInlineSnapshot(`
      {
        "kind": "hosted",
        "modelId": "glm-5.3-flash",
      }
    `)
  })

  test('treats holocron/ as hosted', () => {
    expect(parseMaintainModel('holocron/deepseek-v4-flash')).toMatchInlineSnapshot(`
      {
        "kind": "hosted",
        "modelId": "deepseek-v4-flash",
      }
    `)
  })

  test('treats Holocron/ as hosted ignoring case', () => {
    expect(parseMaintainModel('Holocron/glm-5.3-flash')).toMatchInlineSnapshot(`
      {
        "kind": "hosted",
        "modelId": "glm-5.3-flash",
      }
    `)
  })

  test('treats provider/model as OpenCode BYOK', () => {
    expect(parseMaintainModel('anthropic/claude-sonnet-4-5')).toMatchInlineSnapshot(`
      {
        "kind": "byok",
        "modelId": "claude-sonnet-4-5",
        "providerId": "anthropic",
      }
    `)
  })

  test('keeps slashes inside the OpenCode model id', () => {
    expect(parseMaintainModel('lmstudio/google/gemma-3n-e4b')).toMatchInlineSnapshot(`
      {
        "kind": "byok",
        "modelId": "google/gemma-3n-e4b",
        "providerId": "lmstudio",
      }
    `)
  })

  test('rejects an empty model flag', () => {
    const parsed = parseMaintainModel('')
    if (!(parsed instanceof Error)) throw new Error('expected Error')
    expect(parsed.message).toMatchInlineSnapshot(
      `"Pass a model id, for example glm-5.3-flash or anthropic/claude-sonnet-4-5."`,
    )
  })

  test('rejects a trailing slash', () => {
    const parsed = parseMaintainModel('anthropic/')
    if (!(parsed instanceof Error)) throw new Error('expected Error')
    expect(parsed.message).toMatchInlineSnapshot(
      `"Use provider/model, for example anthropic/claude-sonnet-4-5."`,
    )
  })

  test('rejects a leading slash', () => {
    const parsed = parseMaintainModel('/claude-sonnet-4-5')
    if (!(parsed instanceof Error)) throw new Error('expected Error')
    expect(parsed.message).toMatchInlineSnapshot(
      `"Use provider/model, for example anthropic/claude-sonnet-4-5."`,
    )
  })
})
