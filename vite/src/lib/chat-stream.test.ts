// Tests for the AI chat stream converter.
//
// Every case here maps to a way the assistant answer used to disappear
// silently: the buffered text was dropped when the provider closed the
// stream without `text-end`, provider errors arrived as `error` chunks that
// were ignored, and reasoning was thrown away.
//
// renderText is stubbed so snapshots show plain text instead of React trees.

import { describe, expect, test } from 'vitest'
import { convertChunksToParts, type ChatStreamOutcome } from './chat-stream.ts'
import { modelMessagesToChatMessages, renderMarkdownTextPart } from './chat-restore.tsx'

const renderText = (text: string) => ({ type: 'text' as const, text })

async function* fromChunks(chunks: unknown[]): AsyncGenerator<any> {
  for (const chunk of chunks) yield chunk
}

async function collect(
  chunks: unknown[],
  options: { priorMessages?: unknown[] } = {},
) {
  let outcome: ChatStreamOutcome | undefined
  const parts: unknown[] = []
  for await (const part of convertChunksToParts(fromChunks(chunks), {
    renderText,
    onOutcome: (value) => { outcome = value },
    ...options,
  })) {
    parts.push(part)
  }
  return { parts, outcome: outcome! }
}

/** Drop timing fields so snapshots stay stable. */
function stableOutcome(outcome: ChatStreamOutcome) {
  const { durationMs, ttftMs, ...rest } = outcome
  return { ...rest, ttftMs: ttftMs === null ? null : 'number' }
}

describe('convertChunksToParts', () => {
  test('renders a plain text answer', async () => {
    const { parts, outcome } = await collect([
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Use the ' },
      { type: 'text-delta', id: '1', delta: '`navigation` field.' },
      { type: 'text-end', id: '1' },
      { type: 'finish', finishReason: 'stop' },
    ])
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "text": "Use the \`navigation\` field.",
          "type": "text",
        },
      ]
    `)
    expect(stableOutcome(outcome)).toMatchInlineSnapshot(`
      {
        "aborted": false,
        "answerNotices": 0,
        "chunkTypes": {
          "finish": 1,
          "text-delta": 2,
          "text-end": 1,
          "text-start": 1,
        },
        "flushedAtEnd": false,
        "reasoningChars": 0,
        "sawTextEnd": true,
        "textChars": 27,
        "textParts": 1,
        "toolCalls": 0,
        "ttftMs": "number",
      }
    `)
  })

  test('rescues buffered text when the stream ends without text-end', async () => {
    const { parts, outcome } = await collect([
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Half an answer' },
    ])
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "text": "Half an answer",
          "type": "text",
        },
      ]
    `)
    expect(outcome.sawTextEnd).toBe(false)
    expect(outcome.flushedAtEnd).toBe(true)
  })

  test('surfaces provider error chunks as an error notice', async () => {
    const { parts, outcome } = await collect([
      { type: 'text-start', id: '1' },
      { type: 'text-delta', id: '1', delta: 'Partial ' },
      { type: 'error', errorText: 'upstream 503' },
    ])
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "text": "Partial ",
          "type": "text",
        },
        {
          "code": "HOLOCRON_STREAM_ERROR",
          "display": "always",
          "message": "upstream 503",
          "severity": "error",
          "title": "Something went wrong",
          "type": "notice",
        },
      ]
    `)
    expect(outcome.errorText).toBe('upstream 503')
  })

  test('reports an empty turn instead of yielding nothing', async () => {
    const { parts, outcome } = await collect([
      { type: 'start' },
      { type: 'finish', finishReason: 'stop' },
    ])
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "code": "HOLOCRON_STREAM_ERROR",
          "display": "always",
          "message": "The AI model did not return a response. This usually means the provider is temporarily unavailable. Please try again.",
          "severity": "error",
          "title": "AI model unavailable",
          "type": "notice",
        },
      ]
    `)
    expect(outcome.textParts).toBe(0)
  })

  test('keeps reasoning so a reasoning-only turn is still visible', async () => {
    const { parts } = await collect([
      { type: 'reasoning-start', id: 'r1' },
      { type: 'reasoning-delta', id: 'r1', delta: 'The docs mention navigation.' },
      { type: 'reasoning-end', id: 'r1' },
    ])
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "text": "The docs mention navigation.",
          "type": "reasoning",
        },
      ]
    `)
  })

  test('text that renders nothing is reported as no answer', async () => {
    // renderText returning null models an answer entirely inside a <think>
    // wrapper: chat-render maps those tags to a null component, so the part
    // would be blank. Dropping it lets the empty-turn notice fire.
    let outcome: ChatStreamOutcome | undefined
    const parts: unknown[] = []
    for await (const part of convertChunksToParts(
      fromChunks([
        { type: 'text-delta', id: '1', delta: '<think>only reasoning</think>' },
        { type: 'text-end', id: '1' },
      ]),
      { renderText: () => null, onOutcome: (value) => { outcome = value } },
    )) {
      parts.push(part)
    }
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "code": "HOLOCRON_STREAM_ERROR",
          "display": "always",
          "message": "The AI model did not return a response. This usually means the provider is temporarily unavailable. Please try again.",
          "severity": "error",
          "title": "AI model unavailable",
          "type": "notice",
        },
      ]
    `)
    expect(outcome?.textParts).toBe(0)
  })

  test('flushes text before tool parts so ordering matches the model', async () => {
    const { parts, outcome } = await collect([
      { type: 'text-delta', id: '1', delta: 'Let me check the docs.' },
      { type: 'tool-input-available', toolCallId: 't1', toolName: 'bash', input: { command: 'grep -rn nav /docs' } },
      { type: 'tool-output-available', toolCallId: 't1', output: { stdout: 'docs/nav.mdx:1', stderr: '' } },
      { type: 'text-delta', id: '2', delta: 'Found it.' },
      { type: 'text-end', id: '2' },
    ])
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "text": "Let me check the docs.",
          "type": "text",
        },
        {
          "args": {
            "command": "grep -rn nav /docs",
          },
          "toolCallId": "t1",
          "toolName": "bash",
          "type": "tool-call",
        },
        {
          "output": "docs/nav.mdx:1",
          "toolCallId": "t1",
          "toolName": "bash",
          "type": "tool-result",
        },
        {
          "text": "Found it.",
          "type": "text",
        },
      ]
    `)
    expect(outcome.toolCalls).toBe(1)
  })

  test('reports tool execution errors', async () => {
    const { parts } = await collect([
      { type: 'tool-input-available', toolCallId: 't1', toolName: 'bash', input: { command: 'boom' } },
      { type: 'tool-output-error', toolCallId: 't1', errorText: 'command not found' },
    ])
    expect(parts.at(-1)).toMatchInlineSnapshot(`
      {
        "error": "command not found",
        "output": "",
        "toolCallId": "t1",
        "toolName": "bash",
        "type": "tool-result",
      }
    `)
  })

  test('prepends prior messages to the forwarded model-messages chunk', async () => {
    const { parts } = await collect(
      [
        { type: 'text-delta', id: '1', delta: 'ok' },
        { type: 'text-end', id: '1' },
        { type: 'model-messages', messages: [{ role: 'assistant', content: 'ok' }] },
      ],
      { priorMessages: [{ role: 'user', content: 'hi' }] },
    )
    expect(parts.at(-1)).toMatchInlineSnapshot(`
      {
        "messages": [
          {
            "content": "hi",
            "role": "user",
          },
          {
            "content": "ok",
            "role": "assistant",
          },
        ],
        "type": "model-messages",
      }
    `)
  })

  test('forwards notice and title chunks untouched', async () => {
    const { parts } = await collect([
      { type: 'notice', code: 'HOLOCRON_PROMOTION', title: 'Delightful docs, built with Holocron', message: 'Build with Holocron.' },
      { type: 'text-delta', id: '1', delta: 'hello' },
      { type: 'text-end', id: '1' },
      { type: 'title', title: 'Navigation config' },
    ])
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "code": "HOLOCRON_PROMOTION",
          "message": "Build with Holocron.",
          "title": "Delightful docs, built with Holocron",
          "type": "notice",
        },
        {
          "text": "hello",
          "type": "text",
        },
        {
          "title": "Navigation config",
          "type": "title",
        },
      ]
    `)
  })

  test('rescues text and reports the failure when the stream throws', async () => {
    async function* failing(): AsyncGenerator<any> {
      yield { type: 'text-delta', id: '1', delta: 'Answer so far' }
      throw new Error('connection reset')
    }
    let outcome: ChatStreamOutcome | undefined
    const parts: unknown[] = []
    for await (const part of convertChunksToParts(failing(), {
      renderText,
      onOutcome: (value) => { outcome = value },
    })) {
      parts.push(part)
    }
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "text": "Answer so far",
          "type": "text",
        },
        {
          "code": "HOLOCRON_STREAM_ERROR",
          "display": "always",
          "message": "connection reset",
          "severity": "error",
          "title": "Something went wrong",
          "type": "notice",
        },
      ]
    `)
    expect(outcome?.streamError).toBe('connection reset')
  })

  test('a notice-only turn is a complete answer, not an empty one', async () => {
    // Rate/credit limits yield one notice and stop. Appending an "AI model
    // unavailable" error on top of that would be plain wrong.
    const { parts, outcome } = await collect([
      {
        type: 'notice',
        code: 'HOLOCRON_RATE_LIMIT_REACHED',
        title: 'Rate limit reached',
        message: 'Too many AI chat requests.',
      },
    ])
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "code": "HOLOCRON_RATE_LIMIT_REACHED",
          "message": "Too many AI chat requests.",
          "title": "Rate limit reached",
          "type": "notice",
        },
      ]
    `)
    expect(outcome.answerNotices).toBe(1)
    expect(outcome.errorText).toBeUndefined()
  })

  test('the standing advisory does not count as an answer', async () => {
    // The gateway re-sends this promotion on EVERY turn for free sites. Counting it
    // as output would mark every empty turn as answered — and since the widget
    // renders it only once, the second empty turn would show nothing at all.
    const { parts, outcome } = await collect([
      {
        type: 'notice',
        display: 'once',
        code: 'HOLOCRON_PROMOTION',
        title: 'Delightful docs, built with Holocron',
        message: 'Build with Holocron.',
      },
      { type: 'start' },
      { type: 'finish', finishReason: 'stop' },
    ])
    expect(outcome.answerNotices).toBe(0)
    expect(parts.at(-1)).toMatchInlineSnapshot(`
      {
        "code": "HOLOCRON_STREAM_ERROR",
        "display": "always",
        "message": "The AI model did not return a response. This usually means the provider is temporarily unavailable. Please try again.",
        "severity": "error",
        "title": "AI model unavailable",
        "type": "notice",
      }
    `)
  })

  test('keeps partial text when the turn is aborted', async () => {
    const { parts, outcome } = await collect([
      { type: 'text-delta', id: '1', delta: 'Stopped mid ' },
      { type: 'abort' },
    ])
    expect(parts).toMatchInlineSnapshot(`
      [
        {
          "text": "Stopped mid ",
          "type": "text",
        },
      ]
    `)
    expect(outcome.aborted).toBe(true)
  })
})

// Scratchpad tags (<think> and friends) are registered as null-rendering
// components in chat-render.tsx, so the tag and its contents just disappear.
// renderMarkdownTextPart returns null only when NOTHING would render.
describe('renderMarkdownTextPart', () => {
  /** Rendered through the editorial components (not the raw-text fallback). */
  function rendersMarkdown(part: ReturnType<typeof renderMarkdownTextPart>): boolean {
    const jsx = (part as { jsx?: { props?: { className?: string } } } | null)?.jsx
    return !!jsx && jsx.props?.className !== 'whitespace-pre-wrap'
  }

  test('normal markdown renders through the editorial components', () => {
    expect(rendersMarkdown(renderMarkdownTextPart('Set `navigation.tabs` in **docs.json**.'))).toBe(true)
  })

  test('native HTML is left to safe-mdx, which supports every valid tag', () => {
    expect(rendersMarkdown(renderMarkdownTextPart('<div>still visible</div>'))).toBe(true)
    expect(rendersMarkdown(renderMarkdownTextPart('<kbd>Cmd</kbd> + <kbd>K</kbd>'))).toBe(true)
  })

  test('a think tag next to real content keeps the answer', () => {
    const part = renderMarkdownTextPart('<think>scratchpad</think>\n\nSet `navigation.tabs`.')
    expect(rendersMarkdown(part)).toBe(true)
    expect(part?.text).toContain('Set `navigation.tabs`.')
  })

  test('think tags inside a code fence are ordinary content', () => {
    expect(rendersMarkdown(renderMarkdownTextPart('```md\n<think>example</think>\n```'))).toBe(true)
  })

  test('a wrapper whose contents were all dropped is not an answer', () => {
    // An empty Note frame reads as a hung answer, so it counts as nothing.
    expect(renderMarkdownTextPart('<Note>\n<think>hidden</think>\n</Note>')).toBeNull()
  })

  test('a known component with real content still renders', () => {
    expect(rendersMarkdown(renderMarkdownTextPart('<Note>\nRead the quickstart.\n</Note>'))).toBe(true)
  })

  test('answer wrappers keep their contents', () => {
    // Not valid HTML, so safe-mdx would drop them without the passthrough.
    const part = renderMarkdownTextPart('<answer>The whole answer</answer>')
    expect(rendersMarkdown(part)).toBe(true)
    expect(part?.text).toContain('The whole answer')
  })

  test('an answer entirely inside a think wrapper renders nothing', () => {
    expect(renderMarkdownTextPart('<think>the whole answer</think>')).toBeNull()
  })

  test('an answer wrapped in an invented capitalized component renders nothing', () => {
    expect(renderMarkdownTextPart('<Answer>the whole answer</Answer>')).toBeNull()
  })

  test('unparseable markdown falls back to raw text instead of vanishing', () => {
    const part = renderMarkdownTextPart('<div unclosed')
    expect(part?.text).toBe('<div unclosed')
    expect(rendersMarkdown(part)).toBe(false)
  })
})

// The "no answer" notice is UI-only and never persisted, so the restore path
// has to recreate it. Without that, reloading a conversation whose last turn
// rendered nothing drops the assistant message entirely and leaves a question
// with no reply.
describe('modelMessagesToChatMessages', () => {
  test('restores text, tool calls and tool results in order', () => {
    const messages = modelMessagesToChatMessages([
      { role: 'user', content: 'where is nav configured?' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me look.' },
          { type: 'tool-call', toolCallId: 't1', toolName: 'bash', input: { command: 'grep -rn nav' } },
        ],
      },
      {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 't1', output: { stdout: 'docs.json:12' } }],
      },
      { role: 'assistant', content: 'In `docs.json`.' },
    ])
    expect(messages.map((m) => [m.role, m.parts.map((p) => p.type)])).toMatchInlineSnapshot(`
      [
        [
          "user",
          [
            "text",
          ],
        ],
        [
          "assistant",
          [
            "text",
            "tool-call",
            "tool-result",
            "text",
          ],
        ],
      ]
    `)
  })

  test('a stored answer that renders nothing becomes a notice, not a hole', () => {
    const messages = modelMessagesToChatMessages([
      { role: 'user', content: 'hi' },
      { role: 'assistant', content: '<think>never produced an answer</think>' },
    ])
    expect(messages.at(-1)).toMatchInlineSnapshot(`
      {
        "parts": [
          {
            "code": "HOLOCRON_STREAM_ERROR",
            "display": "always",
            "message": "The AI model did not return a response. This usually means the provider is temporarily unavailable. Please try again.",
            "severity": "error",
            "title": "AI model unavailable",
            "type": "notice",
          },
        ],
        "role": "assistant",
      }
    `)
  })

  test('a turn with only tool calls is not turned into a notice', () => {
    const messages = modelMessagesToChatMessages([
      { role: 'user', content: 'hi' },
      {
        role: 'assistant',
        content: [{ type: 'tool-call', toolCallId: 't1', toolName: 'bash', input: {} }],
      },
    ])
    expect(messages.at(-1)?.parts.map((p) => p.type)).toEqual(['tool-call'])
  })
})
