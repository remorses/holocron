// Tests Maintain --model parsing and real OpenCode V2 sessions against a scripted provider.

import { afterAll, describe, expect, test } from 'vitest'
import { parseMaintainModel, resolveOpencodeBinary, runOpencodeSession, startOpencodeServer } from './maintain.ts'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'

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

// A private OpenCode home: the developer's global config, credentials, and session
// database stay out of the spawned servers.
const opencodeHome = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-opencode-')))
const isolatedEnv = {
  XDG_CONFIG_HOME: path.join(opencodeHome, 'config'),
  XDG_DATA_HOME: path.join(opencodeHome, 'data'),
  XDG_STATE_HOME: path.join(opencodeHome, 'state'),
  XDG_CACHE_HOME: path.join(opencodeHome, 'cache'),
  OPENCODE_DISABLE_MODELS_FETCH: '1',
}

afterAll(() => fs.rmSync(opencodeHome, { recursive: true, force: true }))

describe('startOpencodeServer', () => {
  test('resolves the pinned @opencode/cli binary', () => {
    const binary = resolveOpencodeBinary()
    expect(fs.existsSync(binary)).toBe(true)
    expect(binary.replaceAll('\\', '/')).toMatch(/@opencode\/cli\/bin\/opencode\.exe$/)
  })

  test('the client authenticates, and close() kills the server without an orphan', async () => {
    const server = await startOpencodeServer({ config: {}, env: isolatedEnv })
    if (server instanceof Error) throw server
    expect(isProcessAlive(server.pid)).toBe(true)
    expect((await server.client.server.info()).pid).toBe(server.pid)
    await server.close()
    expect(isProcessAlive(server.pid)).toBe(false)
  }, 30_000)
})

describe('runOpencodeSession', () => {
  test('waits for a background task and returns the answer the root gives after it', async () => {
    const rootRequests: string[] = []
    // Hold the task reply until the root ended its first turn, so the root goes idle while the task runs.
    const rootIdle = Promise.withResolvers<void>()
    const provider = await startFakeProvider(async (body): Promise<FakeReply> => {
      const messages = JSON.stringify(body.messages)
      if (messages.includes('You are a subagent spawned')) {
        await rootIdle.promise
        return { type: 'text', text: 'Page updated.' }
      }
      rootRequests.push(messages)
      if (messages.includes('Page updated.')) return { type: 'text', text: 'Updated docs/index.mdx.' }
      const toolResults = body.messages.filter((message) => message.role === 'tool').length
      if (toolResults === 0) {
        return {
          type: 'tool',
          name: 'subagent',
          arguments: { agent: 'general', description: 'Update index.mdx', prompt: 'Update docs/index.mdx.', background: true },
        }
      }
      if (toolResults === 1) return { type: 'tool', name: 'shell', arguments: { command: 'git push origin main' } }
      rootIdle.resolve()
      return { type: 'text', text: 'Waiting for the task.' }
    })
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-maintain-'))
    const lines: string[] = []
    try {
      const result = await runOpencodeSession({
        directory,
        env: isolatedEnv,
        log: (line) => lines.push(stripVTControlCharacters(line).replace(/ \d+(\.\d+)?m?s\b/, ' <duration>')),
        model: { providerID: 'fake', id: 'fake-model' },
        providers: provider.config,
        system: 'You update docs.',
        prompt: 'Update the selected pages.',
      })
      expect(result).toMatchInlineSnapshot(`
        {
          "finalText": "Updated docs/index.mdx.",
        }
      `)
      expect('\n' + lines.join('\n')).toMatchInlineSnapshot(`
        "
          ◆ task 1 Update index.mdx
          └ subagent Update index.mdx <duration>
          ✗ shell git push origin main <duration> → Permission denied: shell
          │ Waiting for the task.
          [task 1] │ Page updated.
          │ Updated docs/index.mdx."
      `)
      // The instruction entry is the system prompt of every root request.
      expect(rootRequests.length).toBe(4)
      for (const request of rootRequests) expect(request).toContain('You update docs.')
    } finally {
      await provider.close()
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }, 60_000)

  test('returns provider errors as values', async () => {
    const provider = await startFakeProvider(() => ({ type: 'error', status: 401, error: 'bad key' }))
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'holocron-maintain-'))
    try {
      const result = await runOpencodeSession({
        directory,
        env: isolatedEnv,
        log: () => {},
        model: { providerID: 'fake', id: 'fake-model' },
        providers: provider.config,
        system: 'You update docs.',
        prompt: 'hello',
      })
      expect(result instanceof Error ? result.message : result).toMatchInlineSnapshot(`"provider.auth: bad key"`)
    } finally {
      await provider.close()
      fs.rmSync(directory, { recursive: true, force: true })
    }
  }, 60_000)
})

type FakeReply =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; arguments: Record<string, string | boolean> }
  | { type: 'error'; status: number; error: string }

// OpenAI-compatible chat completions endpoint that streams a scripted reply per request.
async function startFakeProvider(reply: (body: { messages: Array<{ role: string }> }) => FakeReply | Promise<FakeReply>) {
  const server = http.createServer(async (req, res) => {
    let raw = ''
    for await (const chunk of req) raw += chunk
    const result = await reply(JSON.parse(raw))
    if (result.type === 'error') {
      res.writeHead(result.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: result.error } }))
      return
    }
    const chunk = (delta: object, finishReason: string | null) => `data: ${JSON.stringify({
      id: 'chatcmpl-1',
      object: 'chat.completion.chunk',
      created: 0,
      model: 'fake-model',
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    if (result.type === 'text') {
      res.write(chunk({ role: 'assistant', content: result.text }, null))
      res.write(chunk({}, 'stop'))
    } else {
      res.write(chunk({
        role: 'assistant',
        tool_calls: [{
          index: 0,
          id: 'call_1',
          type: 'function',
          function: { name: result.name, arguments: JSON.stringify(result.arguments) },
        }],
      }, null))
      res.write(chunk({}, 'tool_calls'))
    }
    res.end('data: [DONE]\n\n')
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('expected a TCP address')
  return {
    config: {
      fake: {
        package: '@opencode/ai/providers/openai-compatible',
        settings: { apiKey: 'x', baseURL: `http://127.0.0.1:${address.port}/v1` },
        models: { 'fake-model': { name: 'fake-model' } },
      },
    },
    close: () => new Promise<void>((resolve) => {
      server.closeAllConnections()
      server.close(() => resolve())
    }),
  }
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}
