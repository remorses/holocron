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

import React from 'react'
import { mdxParse } from 'safe-mdx/parse'
import { P } from '../components/markdown/typography.tsx'
import { ChatRenderNodes } from './chat-render.tsx'
import type { ChatMessage, ChatPart } from '../chat/chat-store.ts'

/** Render assistant markdown text into a ChatPart with server-rendered JSX.
 *  Falls back to preformatted plain text when the markdown fails to parse. */
export function renderMarkdownTextPart(text: string): ChatPart {
  let jsx: React.ReactNode
  try {
    const mdast = mdxParse(text)
    jsx = <ChatRenderNodes markdown={text} nodes={mdast.children} />
  } catch {
    jsx = <P className='whitespace-pre-wrap'>{text}</P>
  }
  return { type: 'text', text, jsx }
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

function appendAssistantPart(messages: ChatMessage[], part: ChatPart): void {
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
      if (typeof content === 'string') {
        if (content.trim()) appendAssistantPart(messages, renderMarkdownTextPart(content))
        continue
      }
      if (!Array.isArray(content)) continue
      for (const part of content) {
        if (!isRecord(part)) continue
        if (part.type === 'text' && typeof part.text === 'string' && part.text.trim()) {
          appendAssistantPart(messages, renderMarkdownTextPart(part.text))
        }
        if (part.type === 'tool-call' && typeof part.toolCallId === 'string') {
          const toolName = typeof part.toolName === 'string' ? part.toolName : 'tool'
          toolNames.set(part.toolCallId, toolName)
          appendAssistantPart(messages, {
            type: 'tool-call',
            toolCallId: part.toolCallId,
            toolName,
            args: isRecord(part.input) ? part.input : {},
          })
        }
      }
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
