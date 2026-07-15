'use client'

/**
 * Combined React hook for the chat widget.
 * Reads from both chatStore (message state) and chatWidgetStore (config).
 * Provides a simple API for external consumers to control the chat.
 */

import { useCallback, useSyncExternalStore } from 'react'
import { chatStore, transitionDrawer } from './chat-store.ts'
import { chatWidgetStore } from './chat-widget-store.ts'
import { startNewChat } from './chat-submit.ts'

// getServerSnapshot must return a CACHED value — a fresh `[]` per call
// triggers React's "result of getServerSnapshot should be cached" warning.
const emptyMessages: never[] = []

export function useChatWidget() {
  const isOpen = useSyncExternalStore(chatStore.subscribe, () => chatStore.getState().drawerState === 'open', () => false)
  const isGenerating = useSyncExternalStore(chatStore.subscribe, () => chatStore.getState().isGenerating, () => false)
  const messages = useSyncExternalStore(chatStore.subscribe, () => chatStore.getState().messages, () => emptyMessages)
  const config = useSyncExternalStore(chatWidgetStore.subscribe, () => chatWidgetStore.getState(), () => chatWidgetStore.getState())

  const open = useCallback(() => {
    transitionDrawer('open')
  }, [])

  const close = useCallback(() => {
    transitionDrawer('closed')
  }, [])

  const toggle = useCallback(() => {
    const current = chatStore.getState().drawerState
    transitionDrawer(current === 'open' ? 'closed' : 'open')
  }, [])

  const clear = useCallback(() => {
    // Rotate to a fresh session; the previous conversation stays in the
    // local session list and can be reopened from the session select.
    startNewChat()
  }, [])

  return { isOpen, isGenerating, messages, open, close, toggle, clear, config }
}
