'use client'

/**
 * Chat state hook — React binding for the vanilla chat store.
 * Keeps server-safe state definitions in chat-store.ts so SSR never has to
 * evaluate Zustand's React bindings from a shared module.
 */

import { useSyncExternalStore } from 'react'
import { chatStore, type ChatState } from './chat-store.ts'

type ChatSelector<T> = (state: ChatState) => T

type ChatStateHook = {
  <T>(selector: ChatSelector<T>): T
  getState: typeof chatStore.getState
  setState: typeof chatStore.setState
  subscribe: typeof chatStore.subscribe
}

export const chatState: ChatStateHook = Object.assign(
  function useChatState<T>(selector: ChatSelector<T>): T {
    return useSyncExternalStore(
      chatStore.subscribe,
      () => selector(chatStore.getState()),
      () => selector(chatStore.getState()),
    )
  },
  {
    getState: chatStore.getState,
    setState: chatStore.setState,
    subscribe: chatStore.subscribe,
  },
)
