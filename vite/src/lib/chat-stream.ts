/**
 * AI chat stream converter — turns the gateway's UIMessageChunk stream into
 * the ChatPart stream the widget renders.
 *
 * Server-only (the default text renderer pulls in safe-mdx). Lives outside
 * app-factory.tsx so it can be unit tested against synthetic chunk streams.
 *
 * ── Why this file is defensive ──────────────────────────────────────
 * Text deltas are buffered and rendered as a whole markdown block, so any
 * path that ends the stream without flushing loses the ENTIRE answer with no
 * error shown. That is the "the response never arrives" bug. Rules:
 *
 * 1. The buffer is flushed on EVERY exit path — normal end of stream and the
 *    catch path both rescue it — so a stream that ends without `text-end`
 *    (provider hiccup, dropped connection) still renders. It cannot be done
 *    in the `finally`: once a consumer calls `return()` the generator can no
 *    longer yield, which is also why a real Stop button cannot be rescued.
 * 2. `error` chunks are surfaced as error notices. The AI SDK does NOT throw
 *    on provider failures: `toUIMessageStream()` converts them into
 *    `{ type: 'error', errorText }` chunks, so dropping unknown chunk types
 *    silently swallowed every provider failure.
 * 3. Reasoning deltas are kept. Reasoning models (deepseek) sometimes put the
 *    whole answer in reasoning; dropping those chunks rendered an empty
 *    assistant bubble.
 * 4. Text that renders to nothing (the model wrapped its whole answer in a
 *    `<think>` tag, which chat-render.tsx maps to a null component) is
 *    reported as "no answer" rather than emitted as a blank part.
 * 5. Terminal notices count as output. A rate-limited turn answers with a
 *    notice and nothing else; treating that as empty stacks a bogus error on
 *    top of it. Standing advisories (`display: 'once'`) do NOT count: that
 *    one is re-sent every turn, so counting it would mark every empty turn
 *    as answered.
 */

import type { ChatPart } from '../chat/chat-store.ts'
import { NO_ANSWER_NOTICE, renderMarkdownTextPart } from './chat-restore.tsx'

/** Chunks the widget consumes. Superset of ChatPart with the control
 *  messages the proxy forwards verbatim. */
export type ChatStreamPart =
  | ChatPart
  | { type: 'model-messages'; messages: unknown[] }
  | { type: 'session'; sessionId: string }
  | { type: 'title'; title: string }

/** Per-turn outcome, reported once when the stream ends. Used for logging so
 *  a turn that produced no text is observable instead of invisible. */
export type ChatStreamOutcome = {
  durationMs: number
  /** Time to the first text delta, null when the turn produced no text. */
  ttftMs: number | null
  textChars: number
  textParts: number
  reasoningChars: number
  toolCalls: number
  /** Notices that ARE the answer: rate limit, credit limit reached. Counted
   *  so a notice-only turn is not reported as empty.
   *
   *  Standing content (`display: 'once'`, such as the Holocron promotion) is
   *  excluded on purpose — the gateway re-sends it on every turn for
   *  free sites, so counting it would mark every empty turn as answered and
   *  bring back the silent empty bubble. */
  answerNotices: number
  /** False when the provider ended the stream mid-text. */
  sawTextEnd: boolean
  /** True when buffered text had to be rescued by the final flush. */
  flushedAtEnd: boolean
  aborted: boolean
  /** Error reported by the model provider through an `error` chunk. */
  errorText?: string
  /** Error thrown while reading the stream (network, decode). */
  streamError?: string
  chunkTypes: Record<string, number>
}

export type ConvertChunksOptions = {
  /** Prepended to the gateway's response messages when forwarding
   *  `model-messages`, so the client keeps the full conversation. */
  priorMessages?: unknown[]
  /** Renders assistant markdown into a ChatPart, or null when the text would
   *  render nothing. Injectable so tests can assert on plain text instead of
   *  a React tree. */
  renderText?: (text: string) => ChatPart | null
  /** Called exactly once when the stream ends, for logging. */
  onOutcome?: (outcome: ChatStreamOutcome) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Human readable error notice. `display: 'always'` because a failure is a
 *  per-turn outcome — de-duplicating it would hide the second failure. */
function errorNotice(message: string): ChatPart {
  // Shared with the restore path so a reloaded conversation shows the same
  // notice for a turn that produced nothing.
  if (message.includes('No output generated')) return { ...NO_ANSWER_NOTICE }
  return {
    type: 'notice',
    severity: 'error',
    display: 'always',
    code: 'HOLOCRON_STREAM_ERROR',
    title: 'Something went wrong',
    message,
  }
}

/**
 * Convert the gateway's UIMessageChunk stream into renderable ChatParts.
 *
 * Text is buffered and flushed as a whole markdown block on `text-end`,
 * before every tool part (some providers close the text part only after the
 * tool input chunk), before `model-messages`, and unconditionally when the
 * stream ends.
 */
export async function* convertChunksToParts(
  uiStream: AsyncIterable<any>,
  options: ConvertChunksOptions = {},
): AsyncGenerator<ChatStreamPart> {
  const renderText = options.renderText ?? renderMarkdownTextPart
  const startedAt = Date.now()

  let textBuffer = ''
  let reasoningBuffer = ''
  const toolNames = new Map<string, string>()

  const outcome: ChatStreamOutcome = {
    durationMs: 0,
    ttftMs: null,
    textChars: 0,
    textParts: 0,
    reasoningChars: 0,
    toolCalls: 0,
    answerNotices: 0,
    sawTextEnd: false,
    flushedAtEnd: false,
    aborted: false,
    chunkTypes: {},
  }

  /** Emit buffered reasoning (if any) followed by buffered text. */
  function* flush(): Generator<ChatStreamPart> {
    if (reasoningBuffer.trim()) {
      outcome.reasoningChars += reasoningBuffer.length
      yield { type: 'reasoning', text: reasoningBuffer.trim() }
    }
    reasoningBuffer = ''

    const text = textBuffer
    textBuffer = ''
    if (!text.trim()) return

    // null means the text renders nothing (a whole answer inside a <think>
    // wrapper). Emitting a blank part would look like a hang, so it is
    // dropped and the turn is reported as having produced no answer.
    const part = renderText(text)
    if (!part) return
    outcome.textChars += text.length
    outcome.textParts += 1
    yield part
  }

  try {
    for await (const chunk of uiStream) {
      const type = typeof chunk?.type === 'string' ? chunk.type : 'unknown'
      outcome.chunkTypes[type] = (outcome.chunkTypes[type] ?? 0) + 1

      switch (type) {
        // Forwarded verbatim to the widget. A terminal notice (rate limit,
        // credit limit) IS the answer; a standing advisory is not.
        case 'notice':
          if (chunk.display !== 'once') outcome.answerNotices += 1
          yield chunk
          continue

        case 'title':
          yield chunk
          continue

        case 'text-delta':
          if (outcome.ttftMs === null) outcome.ttftMs = Date.now() - startedAt
          textBuffer += chunk.delta ?? ''
          continue

        case 'text-end':
          outcome.sawTextEnd = true
          yield* flush()
          continue

        case 'reasoning-delta':
          reasoningBuffer += chunk.delta ?? ''
          continue

        // Reasoning is flushed together with the text block it precedes, so
        // reasoning-end alone does not emit — otherwise a model that
        // interleaves reasoning and text would produce a part per token run.
        case 'reasoning-end':
          continue

        case 'tool-input-available':
          yield* flush()
          toolNames.set(chunk.toolCallId, chunk.toolName)
          outcome.toolCalls += 1
          yield {
            type: 'tool-call',
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            args: isRecord(chunk.input) ? chunk.input : {},
          }
          continue

        case 'tool-output-available': {
          yield* flush()
          // bash results carry { stdout, stderr }; other tools carry
          // arbitrary shapes, which render as an empty preview.
          const output = isRecord(chunk.output) ? chunk.output : {}
          const stdout = typeof output.stdout === 'string' ? output.stdout : ''
          const stderr = typeof output.stderr === 'string' ? output.stderr : ''
          yield {
            type: 'tool-result',
            toolCallId: chunk.toolCallId,
            toolName: toolNames.get(chunk.toolCallId) || 'bash',
            output: stdout.slice(0, 500),
            ...(stderr ? { error: stderr } : {}),
          }
          continue
        }

        case 'tool-output-error':
          yield* flush()
          yield {
            type: 'tool-result',
            toolCallId: chunk.toolCallId,
            toolName: toolNames.get(chunk.toolCallId) || 'bash',
            output: '',
            error: typeof chunk.errorText === 'string' ? chunk.errorText : 'Tool execution failed',
          }
          continue

        // The AI SDK reports provider failures as chunks, never as throws.
        case 'error': {
          yield* flush()
          const message = typeof chunk.errorText === 'string' && chunk.errorText
            ? chunk.errorText
            : 'The AI provider returned an error.'
          outcome.errorText = message
          yield errorNotice(message)
          continue
        }

        case 'abort':
          outcome.aborted = true
          yield* flush()
          continue

        case 'model-messages':
          yield* flush()
          yield {
            type: 'model-messages',
            messages: [...(options.priorMessages ?? []), ...(chunk.messages ?? [])],
          }
          continue

        default:
          continue
      }
    }

    // Stream ended without text-end (provider closed mid-text, dropped
    // connection). Without this the whole answer would be discarded.
    const rescued = [...flush()]
    if (rescued.length > 0) {
      outcome.flushedAtEnd = true
      for (const part of rescued) yield part
    }

    // Nothing renderable at all — surface it instead of an empty bubble.
    if (
      outcome.textParts === 0 &&
      outcome.reasoningChars === 0 &&
      outcome.toolCalls === 0 &&
      outcome.answerNotices === 0 &&
      !outcome.errorText &&
      !outcome.aborted
    ) {
      outcome.errorText = 'No output generated'
      yield errorNotice('No output generated')
    }
  } catch (error) {
    outcome.streamError = error instanceof Error ? error.message : String(error)
    // Rescue whatever arrived before the failure, then tell the user.
    const rescued = [...flush()]
    outcome.flushedAtEnd = rescued.length > 0
    for (const part of rescued) yield part
    yield errorNotice(outcome.streamError)
  } finally {
    outcome.durationMs = Date.now() - startedAt
    options.onOutcome?.(outcome)
  }
}
