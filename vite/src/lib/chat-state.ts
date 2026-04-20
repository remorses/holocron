'use client'

/**
 * Chat state hook — React binding for the vanilla chat store.
 * Keeps server-safe state definitions in chat-store.ts so SSR never has to
 * evaluate Zustand's React bindings from a shared module.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react'
import { chatStore, type ChatState } from './chat-store.ts'

type ChatSelector<T> = (state: ChatState) => T

type ChatStateHook = {
  <T>(selector: ChatSelector<T>): T
  getState: typeof chatStore.getState
  setState: typeof chatStore.setState
  subscribe: typeof chatStore.subscribe
}

/**
 * useSyncExternalStore requires stable function references for subscribe,
 * getSnapshot, and getServerSnapshot — otherwise React re-subscribes on
 * every render. We use useCallback with a ref to keep the selector fresh
 * while returning a stable getSnapshot identity.
 */
export const chatState: ChatStateHook = Object.assign(
  function useChatState<T>(selector: ChatSelector<T>): T {
    const selectorRef = useRef(selector)
    selectorRef.current = selector
    const getSnapshot = useCallback(() => selectorRef.current(chatStore.getState()), [])
    const getServerSnapshot = useCallback(() => selectorRef.current(chatStore.getState()), [])
    return useSyncExternalStore(chatStore.subscribe, getSnapshot, getServerSnapshot)
  },
  {
    getState: chatStore.getState,
    setState: chatStore.setState,
    subscribe: chatStore.subscribe,
  },
)
