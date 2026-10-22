'use client'

/**
 * ChatDrawer — renders the code-split ChatDrawerPanel while the drawer is
 * open. The panel module loads through setChatDrawerState() or
 * preloadChatDrawer() (chat-store.ts), never during first page load.
 */

import React, { useSyncExternalStore } from 'react'
import { chatStore, getChatDrawerPanel, subscribeChatDrawerPanel } from './chat-store.ts'

const getIsOpen = () => chatStore.getState().drawerState === 'open'
const getFalse = () => false
const getNull = () => null

export function ChatDrawer() {
  const isOpen = useSyncExternalStore(chatStore.subscribe, getIsOpen, getFalse)
  const Panel = useSyncExternalStore(subscribeChatDrawerPanel, getChatDrawerPanel, getNull)
  if (!isOpen || !Panel) return null
  return <Panel />
}
