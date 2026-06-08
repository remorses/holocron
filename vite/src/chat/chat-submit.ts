'use client'

/**
 * Chat submission logic — extracted from ChatDrawer so both the holocron
 * integration and the standalone widget can share the same fetch+stream code.
 *
 * Reads/writes chatStore directly. Caller provides the API URL and current slug
 * via chatWidgetStore (already set before submitChat is called).
 */

import { decodeFederationPayload } from 'spiceflow/react'
import { chatStore } from './chat-store.ts'
import type { ChatMessage, ChatModelMessage, ChatPart } from './chat-store.ts'
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

/**
 * Submit a chat message. Reads chatApiUrl and currentSlug from chatWidgetStore,
 * manages chatStore state (messages, isGenerating, etc.), and streams the response.
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

  const modelMessages = chatStore.getState().modelMessages
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

  if (onScrollToLastUser) {
    setTimeout(onScrollToLastUser, 0)
  }

  try {
    const response = await fetch(chatApiUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        modelMessages,
        message: submitText,
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
      stream: AsyncIterable<ChatPart | { type: 'model-messages'; messages: ChatModelMessage[] }>
    }>(response)

    for await (const part of decoded.stream) {
      if (part.type === 'model-messages') {
        chatStore.setState({ modelMessages: part.messages })
        continue
      }
      chatStore.setState((s) => ({
        messages: appendAssistantPart(s.messages, part),
      }))
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // User clicked stop — keep whatever parts arrived
    } else {
      console.error('Chat error:', error)
      chatStore.setState({
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
