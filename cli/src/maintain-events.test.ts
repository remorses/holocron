// Tests formatting of OpenCode server logs and session events printed by holocron maintain.

import { stripVTControlCharacters } from 'node:util'
import { describe, expect, test } from 'vitest'
import type { Event } from '@opencode-ai/sdk/v2/types'
import { createEventPrinter, formatServerLog } from './maintain-events.ts'

const plain = (text: string) => stripVTControlCharacters(text)

describe('formatServerLog', () => {
  test('drops timestamp and run id, keeps message and fields', () => {
    const line = 'timestamp=2026-09-23T11:24:50.706Z level=ERROR run=9ebc9cc1 message="stream error" providerID=holocron modelID=deepseek-v4-flash session.id=ses_1 small=false agent=general mode=subagent error.error="AI_APICallError: Rate limit exceeded."'
    expect(plain(formatServerLog(line))).toMatchInlineSnapshot(`"  opencode ERROR stream error agent=general error.error=AI_APICallError: Rate limit exceeded."`)
  })
})

describe('createEventPrinter', () => {
  test('prints task sessions, finished text, and completed or failed tool calls once', () => {
    const lines: string[] = []
    const printer = createEventPrinter({ repoRoot: '/repo', rootSessionID: 'root', write: (line) => lines.push(plain(line)) })
    const tool = (id: string, sessionID: string, state: object) => ({
      id: `e-${id}`,
      type: 'message.part.updated',
      properties: { sessionID, time: 0, part: { id, sessionID, messageID: 'm', type: 'tool', callID: id, tool: 'bash', state } },
    }) as Event
    const events = [
      { id: 'e1', type: 'session.created', properties: { sessionID: 'child', info: { id: 'child', parentID: 'root', title: 'Update index.mdx (@general subagent)' } } },
      { id: 'e2', type: 'message.part.updated', properties: { sessionID: 'root', time: 0, part: { id: 't1', sessionID: 'root', messageID: 'm', type: 'text', text: 'Splitting the work.', time: { start: 0 } } } },
      { id: 'e3', type: 'message.part.updated', properties: { sessionID: 'root', time: 0, part: { id: 't1', sessionID: 'root', messageID: 'm', type: 'text', text: 'Splitting the work.', time: { start: 0, end: 1 } } } },
      tool('b1', 'child', { status: 'running', input: { command: 'git diff HEAD~1' }, time: { start: 0 } }),
      tool('b1', 'child', { status: 'completed', input: { command: 'git diff HEAD~1' }, output: '', title: '', metadata: {}, time: { start: 0, end: 1500 } }),
      tool('b1', 'child', { status: 'completed', input: { command: 'git diff HEAD~1' }, output: '', title: '', metadata: {}, time: { start: 0, end: 1500 } }),
      tool('b2', 'root', { status: 'error', input: { command: 'git push origin main' }, error: 'The user has specified a rule which prevents you from using this specific tool call.\nmore', time: { start: 0, end: 3 } }),
      { id: 'e4', type: 'message.part.updated', properties: { sessionID: 'root', time: 0, part: { id: 'r1', sessionID: 'root', messageID: 'm', type: 'tool', callID: 'r1', tool: 'read', state: { status: 'completed', input: { filePath: '/repo/docs/index.mdx' }, output: '', title: '', metadata: {}, time: { start: 0, end: 20 } } } } },
      { id: 'e5', type: 'session.error', properties: { sessionID: 'child', error: { name: 'APIError', data: { message: 'Rate limit exceeded.', isRetryable: true } } } },
    ] as Event[]
    for (const event of events) printer.handle(event)
    expect('\n' + lines.join('\n')).toMatchInlineSnapshot(`
      "
        ◆ task 1 Update index.mdx (@general subagent)
        │ Splitting the work.
        [task 1] └ bash git diff HEAD~1 1.5s
        ✗ bash git push origin main 3ms → The user has specified a rule which prevents you from using this specific tool call. …
        └ read docs/index.mdx 20ms
        [task 1] ✗ APIError: Rate limit exceeded."
    `)
  })
})
