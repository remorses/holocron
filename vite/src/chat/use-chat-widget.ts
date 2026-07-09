'use client'

/**
 * Combined React hook for the chat widget.
 * Reads from both chatStore (message state) and chatWidgetStore (config).
 * Provides a simple API for external consumers to control the chat.
 */

import { useCallback, useSyncExternalStore } from 'react'
import { chatStore } from './chat-store.ts'
import { chatWidgetStore } from './chat-widget-store.ts'
import { clearChatSession } from './chat-submit.ts'

export function useChatWidget() {
  const isOpen = useSyncExternalStore(chatStore.subscribe, () => chatStore.getState().drawerState === 'open', () => false)
  const isGenerating = useSyncExternalStore(chatStore.subscribe, () => chatStore.getState().isGenerating, () => false)
  const messages = useSyncExternalStore(chatStore.subscribe, () => chatStore.getState().messages, () => [])
  const config = useSyncExternalStore(chatWidgetStore.subscribe, () => chatWidgetStore.getState(), () => chatWidgetStore.getState())

  const open = useCallback(() => {
    chatStore.setState({ drawerState: 'open' })
  }, [])

  const close = useCallback(() => {
    chatStore.setState({ drawerState: 'closed' })
  }, [])

  const toggle = useCallback(() => {
    const current = chatStore.getState().drawerState
    chatStore.setState({ drawerState: current === 'open' ? 'closed' : 'open' })
  }, [])

  const clear = useCallback(() => {
    chatStore.getState().abortController?.abort()
    // Also delete the persisted server-side conversation + session id.
    void clearChatSession()
    chatStore.setState({
      isGenerating: false,
      abortController: null,
      messages: [],
      modelMessages: [],
      draftText: '',
      pendingSubmit: false,
      errorMessage: null,
      approvalResolvers: {},
    })
  }, [])

  return { isOpen, isGenerating, messages, open, close, toggle, clear, config }
}
