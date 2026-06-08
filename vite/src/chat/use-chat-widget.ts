'use client'

/**
 * Combined React hook for the chat widget.
 * Reads from both chatStore (message state) and chatWidgetStore (config).
 * Provides a simple API for external consumers to control the chat.
 */

import { useCallback } from 'react'
import { useStore } from 'zustand'
import { chatStore } from './chat-store.ts'
import { chatWidgetStore } from './chat-widget-store.ts'

export function useChatWidget() {
  const isOpen = useStore(chatStore, (s) => s.drawerState === 'open')
  const isGenerating = useStore(chatStore, (s) => s.isGenerating)
  const messages = useStore(chatStore, (s) => s.messages)
  const config = useStore(chatWidgetStore, (s) => s)

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
    chatStore.setState({
      isGenerating: false,
      abortController: null,
      messages: [],
      modelMessages: [],
      draftText: '',
      pendingSubmit: false,
      errorMessage: null,
    })
  }, [])

  return { isOpen, isGenerating, messages, open, close, toggle, clear, config }
}
