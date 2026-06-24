'use client'

/**
 * Chat submission logic — extracted from ChatDrawer so both the holocron
 * integration and the standalone widget can share the same fetch+stream code.
 *
 * The browser always POSTs to /holocron-api/chat. The server decides where
 * to route (holocron gateway or custom Flue agent) and does RSC rendering.
 *
 * Reads/writes chatStore directly. Caller provides the API URL and current slug
 * via chatWidgetStore (already set before submitChat is called).
 */

import { decodeFederationPayload } from 'spiceflow/react'
import { chatStore } from './chat-store.ts'
import type { ChatMessage, ChatPart } from './chat-store.ts'
import { chatWidgetStore } from './chat-widget-store.ts'

function appendAssistantPart(messages: ChatMessage[], part: ChatPart): ChatMessage[] {
  const lastMessage = messages.at(-1)
  if (lastMessage?.role === 'assistant') {
    return [
      ...messages.slice(0, -1),
      { role: 'assistant', parts: [...lastMessage.parts, part] },
    ]
  }
  return [...messages, { role: 'assistant', parts: [part] }]
}

/** Generate or retrieve a visitor ID for session continuity. */
function getOrCreateVisitorId(): string {
  const key = 'holocron-chat-visitor-id'
  if (typeof localStorage === 'undefined') return crypto.randomUUID()
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return id
}

/**
 * Submit a chat message. Always goes through the server proxy route which
 * handles both holocron-hosted and custom agent modes, plus RSC rendering.
 *
 * @param text - Optional override text. If not provided, reads from chatStore.draftText.
 * @param onScrollToLastUser - Optional callback to scroll UI after user message is added.
 */
export async function submitChat(
  text?: string,
  onScrollToLastUser?: () => void,
): Promise<void> {
  const submitText = text || chatStore.getState().draftText.trim()
  if (!submitText) return
  if (chatStore.getState().isGenerating) return

  const { chatApiUrl, currentSlug } = chatWidgetStore.getState()
  if (!chatApiUrl) {
    console.error('chatWidgetStore.chatApiUrl is not set')
    return
  }

  const nextUserMessage: ChatMessage = { role: 'user', parts: [{ type: 'text', text: submitText }] }
  const controller = new AbortController()
  chatStore.setState((s) => ({
    isGenerating: true,
    messages: [...s.messages, nextUserMessage],
    draftText: '',
    pendingSubmit: false,
    errorMessage: null,
    abortController: controller,
  }))

  if (onScrollToLastUser) setTimeout(onScrollToLastUser, 0)

  try {
    const visitorId = getOrCreateVisitorId()

    // Generate a per-conversation session ID on first submit. Resets to ''
    // on "new chat" so each conversation gets its own Flue DO instance.
    let chatSessionId = chatStore.getState().sessionId
    if (!chatSessionId) {
      chatSessionId = crypto.randomUUID()
      chatStore.setState({ sessionId: chatSessionId })
    }

    const response = await fetch(chatApiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: submitText,
        visitorId,
        chatSessionId,
        currentSlug: currentSlug || '/',
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => undefined)
      chatStore.setState({
        errorMessage: typeof errorBody?.error === 'string'
          ? errorBody.error
          : `Chat request failed: ${response.status} ${response.statusText}`,
      })
      return
    }

    const decoded = await decodeFederationPayload<{
      stream: AsyncIterable<ChatPart>
    }>(response)

    for await (const part of decoded.stream) {
      chatStore.setState((s) => ({
        messages: appendAssistantPart(s.messages, part),
      }))
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // User clicked stop — keep whatever parts arrived.
      // Reset sessionId so the next message creates a fresh Flue session
      // instead of hitting the still-busy DO from the aborted request.
      chatStore.setState({ sessionId: '' })
    } else {
      console.error('Chat error:', error)
      // Reset sessionId so the next attempt starts a fresh Flue session.
      // This avoids hitting "Request is malformed" when the previous
      // session's DO is still processing an aborted submission.
      chatStore.setState({
        sessionId: '',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
      })
    }
  } finally {
    chatStore.setState({
      isGenerating: false,
      abortController: null,
    })
  }
}
