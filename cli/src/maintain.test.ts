// Tests Maintain --model parsing for Holocron-hosted vs OpenCode BYOK ids.

import { describe, expect, test } from 'vitest'
import { Agent, type RequestInit as UndiciRequestInit } from 'undici'
import { createMaintainClient, parseMaintainModel, resolveOpencodeBinary, startOpencodeServer } from './maintain.ts'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

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

describe('startOpencodeServer', () => {
  test('resolves the pinned opencode-ai binary', () => {
    const binary = resolveOpencodeBinary()
    expect(fs.existsSync(binary)).toBe(true)
    expect(binary.replaceAll('\\', '/')).toMatch(/opencode-ai\/bin\/opencode\.exe$/)
  })

  test('close() kills the server process and does not leave an orphan', async () => {
    const server = await startOpencodeServer({ config: {} })
    if (server instanceof Error) throw server
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
    expect(isProcessAlive(server.pid)).toBe(true)
    await server.close()
    expect(isProcessAlive(server.pid)).toBe(false)
  }, 30_000)
})

describe('createMaintainClient', () => {
  test('Node fetch honours an external undici dispatcher (the headers timeout we disable)', async () => {
    // The fix relies on Node's built-in fetch accepting an Agent from the
    // `undici` package. Prove it with a short timeout against a slow server.
    const slow = http.createServer((_req, res) => {
      setTimeout(() => res.end('late'), 1_500)
    })
    await new Promise<void>((resolve) => slow.listen(0, '127.0.0.1', resolve))
    const address = slow.address()
    if (!address || typeof address === 'string') throw new Error('expected a TCP address')
    try {
      const init: RequestInit & Pick<UndiciRequestInit, 'dispatcher'> = {
        dispatcher: new Agent({ headersTimeout: 300 }),
      }
      await expect(fetch(`http://127.0.0.1:${address.port}/`, init)).rejects.toMatchObject({
        message: 'fetch failed',
        cause: { code: 'UND_ERR_HEADERS_TIMEOUT' },
      })
    } finally {
      slow.closeAllConnections()
      slow.close()
    }
  })

  test('blocking session.prompt works through the custom fetch and surfaces provider errors', async () => {
    // Provider endpoint that always fails: exercises the SDK through our
    // dispatcher-backed fetch without a real model, and proves the error
    // lands on info.error. 401 and not 500: OpenCode retries 5xx for minutes.
    const provider = http.createServer((_req, res) => {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'bad key' } }))
    })
    await new Promise<void>((resolve) => provider.listen(0, '127.0.0.1', resolve))
    const address = provider.address()
    if (!address || typeof address === 'string') throw new Error('expected a TCP address')
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-maintain-'))

    const server = await startOpencodeServer({
      config: {
        model: 'fake/fake-model',
        provider: {
          fake: {
            npm: '@ai-sdk/openai-compatible',
            options: { apiKey: 'x', baseURL: `http://127.0.0.1:${address.port}/v1` },
            models: { 'fake-model': { name: 'fake-model' } },
          },
        },
      },
    })
    if (server instanceof Error) throw server
    try {
      const client = createMaintainClient({ baseUrl: server.url, directory })
      const session = await client.session.create({ title: 'test' }, { throwOnError: true })
      const result = await client.session.prompt({
        sessionID: session.data.id,
        model: { providerID: 'fake', modelID: 'fake-model' },
        parts: [{ type: 'text', text: 'hello' }],
      }, { throwOnError: true })
      expect(result.data.info.role).toBe('assistant')
      expect(result.data.info.error?.name).toBeTypeOf('string')
    } finally {
      await server.close()
      provider.close()
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }, 90_000)
})

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
