/**
 * Chat session restore — pure projection of stored AI SDK ModelMessages into
 * the ChatMessage/ChatPart shape the chat widget renders.
 *
 * Server-only (imports safe-mdx + editorial components). Used by the
 * /holocron-api/chat/session restore route in app-factory to rebuild the
 * exact same UI (markdown rendered to JSX via ChatRenderNodes) from a
 * persisted conversation, without re-running any AI streaming.
 *
 * The live streaming path in app-factory shares renderMarkdownTextPart so
 * restored and streamed messages render identically.
 */

import type { Root, RootContent } from 'mdast'
import { mdxParse } from 'safe-mdx/parse'
import { P } from '../components/markdown/typography.tsx'
import { ChatRenderNodes, DROPPED_CHAT_TAGS } from './chat-render.tsx'
import { mdxComponents } from './mdx-components-map.tsx'
import type { ChatMessage, ChatPart } from '../chat/chat-store.ts'

const droppedTags = new Set<string>(DROPPED_CHAT_TAGS)

/**
 * True when safe-mdx drops this JSX node and everything inside it.
 *
 * Two cases: a scratchpad tag (registered as a null component in
 * chat-render.tsx) and an unknown CAPITALIZED name, which can never resolve.
 *
 * Unknown lowercase names are assumed to render, because safe-mdx merges its
 * own `nativeTags` list of every valid HTML element on top of the component
 * map — and that list is not exported from the package, so it cannot be
 * consulted here. The gap is an invented lowercase wrapper that is not valid
 * HTML; the common ones are handled by PASSTHROUGH_CHAT_TAGS. Exporting
 * `nativeTags` from safe-mdx would make this exact.
 */
function isDropped(node: RootContent): boolean {
  if (node.type !== 'mdxJsxFlowElement' && node.type !== 'mdxJsxTextElement') return false
  const name = node.name?.split('.')[0]
  if (!name) return true
  if (Object.hasOwn(mdxComponents, name)) return false
  return droppedTags.has(name.toLowerCase()) || /^[A-Z]/.test(name)
}

/**
 * True when safe-mdx would render at least something for these nodes.
 *
 * One rule: a node with children is visible only if its children are. A
 * wrapper whose entire contents were dropped renders an empty frame, which
 * reads as a hung answer, so it counts as nothing. Childless nodes (images,
 * thematic breaks, prop-only components) are visible.
 */
function hasVisibleContent(nodes: RootContent[]): boolean {
  return nodes.some((node) => {
    if (isDropped(node)) return false
    if (node.type === 'text') return !!node.value.trim()
    const children = 'children' in node ? (node.children as RootContent[]) : undefined
    if (children?.length) return hasVisibleContent(children)
    return true
  })
}

/**
 * Render assistant markdown into a ChatPart with server-rendered JSX.
 *
 * Returns null when the text renders nothing (a whole answer inside a
 * `<think>` wrapper). Callers treat that as "no answer", which surfaces an
 * explicit notice instead of an empty bubble.
 *
 * Unparseable MDX still returns a part: showing the raw text beats losing it.
 */
export function renderMarkdownTextPart(text: string): ChatPart | null {
  let mdast: Root
  try {
    mdast = mdxParse(text)
  } catch {
    return { type: 'text', text, jsx: <P className='whitespace-pre-wrap'>{text}</P> }
  }
  if (!hasVisibleContent(mdast.children)) return null
  return { type: 'text', text, jsx: <ChatRenderNodes markdown={text} nodes={mdast.children} /> }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Extract the plain text of a user/assistant message content field. */
function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((part) => isRecord(part) && part.type === 'text' && typeof part.text === 'string')
      .map((part) => (part as { text: string }).text)
      .join('')
  }
  return ''
}

/** Format a stored ToolResultPart output into the display string + error flag
 *  the widget's tool-result part expects. Mirrors the live streaming path
 *  (bash results carry { stdout, stderr }; other tools carry text or JSON). */
function formatToolOutput(output: unknown): { output: string; error?: string } {
  if (isRecord(output)) {
    // AI SDK v6 ToolResultPart output: { type: 'text'|'error-text'|'json'|..., value }
    if (output.type === 'error-text' && typeof output.value === 'string') {
      return { output: '', error: output.value }
    }
    if (output.type === 'text' && typeof output.value === 'string') {
      return { output: output.value.slice(0, 500) }
    }
    const value = 'value' in output ? output.value : output
    if (isRecord(value) && (typeof value.stdout === 'string' || typeof value.stderr === 'string')) {
      return {
        output: (typeof value.stdout === 'string' ? value.stdout : '').slice(0, 500),
        ...(typeof value.stderr === 'string' && value.stderr ? { error: value.stderr } : {}),
      }
    }
    return { output: JSON.stringify(value).slice(0, 500) }
  }
  return { output: String(output ?? '').slice(0, 500) }
}

/**
 * Shown when a turn produced nothing renderable. Shared by the live stream
 * (chat-stream.ts) and the restore path, because this notice is UI-only and
 * is never persisted in the stored ModelMessages — without it a reloaded
 * conversation would end with a question and no reply at all.
 */
export const NO_ANSWER_NOTICE: ChatPart = {
  type: 'notice',
  severity: 'error',
  display: 'always',
  code: 'HOLOCRON_STREAM_ERROR',
  title: 'AI model unavailable',
  message:
    'The AI model did not return a response. This usually means the provider is temporarily unavailable. Please try again.',
}

/** Appends a part, ignoring the null renderMarkdownTextPart returns for text
 *  that renders nothing. */
function appendAssistantPart(messages: ChatMessage[], part: ChatPart | null): void {
  if (!part) return
  const last = messages.at(-1)
  if (last?.role === 'assistant') {
    last.parts.push(part)
    return
  }
  messages.push({ role: 'assistant', parts: [part] })
}

/**
 * Convert stored ModelMessages into renderable ChatMessages.
 *
 * - user messages → user ChatMessage with plain text part
 * - assistant text → text part with server-rendered JSX
 * - assistant tool-call parts → tool-call parts
 * - tool role results → tool-result parts, merged into the preceding
 *   assistant message (matching how the live stream appends them)
 */
export function modelMessagesToChatMessages(modelMessages: unknown[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  const toolNames = new Map<string, string>()

  for (const raw of modelMessages) {
    if (!isRecord(raw)) continue

    if (raw.role === 'user') {
      const text = contentToText(raw.content)
      if (text) messages.push({ role: 'user', parts: [{ type: 'text', text }] })
      continue
    }

    if (raw.role === 'assistant') {
      const content = raw.content
      // Collected first so a turn whose only text renders to nothing can be
      // detected before anything is appended.
      const parts: ChatPart[] = []
      let hadStoredText = false

      if (typeof content === 'string') {
        if (content.trim()) {
          hadStoredText = true
          const part = renderMarkdownTextPart(content)
          if (part) parts.push(part)
        }
      } else if (Array.isArray(content)) {
        for (const part of content) {
          if (!isRecord(part)) continue
          if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
            hadStoredText = true
            const rendered = renderMarkdownTextPart(part.text)
            if (rendered) parts.push(rendered)
          }
          // Keeps restored turns identical to live ones for reasoning models.
          if (part.type === 'reasoning' && typeof part.text === 'string' && part.text.trim()) {
            parts.push({ type: 'reasoning', text: part.text.trim() })
          }
          if (part.type === 'tool-call' && typeof part.toolCallId === 'string') {
            const toolName = typeof part.toolName === 'string' ? part.toolName : 'tool'
            toolNames.set(part.toolCallId, toolName)
            parts.push({
              type: 'tool-call',
              toolCallId: part.toolCallId,
              toolName,
              args: isRecord(part.input) ? part.input : {},
            })
          }
        }
      }

      // The model answered, but everything it wrote renders to nothing (a
      // whole answer inside a <think> wrapper). The live stream shows a
      // notice there; without this the turn would silently disappear on
      // reload, leaving a question with no reply.
      if (hadStoredText && parts.length === 0) parts.push({ ...NO_ANSWER_NOTICE })

      for (const part of parts) appendAssistantPart(messages, part)
      continue
    }

    if (raw.role === 'tool' && Array.isArray(raw.content)) {
      for (const part of raw.content) {
        if (!isRecord(part) || part.type !== 'tool-result' || typeof part.toolCallId !== 'string') continue
        const formatted = formatToolOutput(part.output)
        appendAssistantPart(messages, {
          type: 'tool-result',
          toolCallId: part.toolCallId,
          toolName:
            (typeof part.toolName === 'string' && part.toolName) ||
            toolNames.get(part.toolCallId) ||
            'tool',
          ...formatted,
        })
      }
    }
  }

  return messages
}
