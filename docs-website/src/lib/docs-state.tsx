'use client'
import type { PageTree, TOCItemType } from 'fumadocs-core/server'

import { create } from 'zustand'
import { createIdGenerator, UIMessage } from 'ai'
import { highlightText } from './highlight-text.js'

const generateId = createIdGenerator()
export function generateChatId(): string {
  return generateId()
}

export type FilesInDraft = Record<
  string,
  {
    content: string | null
    githubPath: string
  }
>

export type ChatHistory = {
  messages: UIMessage[]
  createdAt: string
}

export type DrawerState = 'closed' | 'minimized' | 'open'

export type PersistentDocsState = {
  chatId: string
  drawerState: DrawerState
  chatHistory: Record<string, ChatHistory>
}

export type DocsState = {
  // tree?: PageTree.Root
  toc?: TOCItemType[]
  websocketServerPreviewConnected?: boolean
  currentSlug?: string
  // docsJson?: DocsJsonType
  filesInDraft: FilesInDraft
  isMarkdownStreaming?: boolean
  deletedPages: Array<{
    slug: string
  }>
  previewMode?: 'preview' | 'editor'
  highlightedLines?: {
    slug: string
    startLine: number
    endLine: number
  }
}

const defaultState: DocsState = {
  filesInDraft: {},
  deletedPages: [],
  previewMode: 'preview',
}

const defaultPersistentState: PersistentDocsState = {
  chatId: generateChatId(),
  drawerState: 'closed',
  chatHistory: {},
}

export const useDocsState = create<DocsState>(() => defaultState)

export const usePersistentDocsState = create<PersistentDocsState>(
  () => defaultPersistentState,
)

// Save chat messages with limit of 10 messages per chat
export function saveChatMessages(chatId: string, messages: UIMessage[]) {
  const state = usePersistentDocsState.getState()
  const existingHistory = state.chatHistory[chatId]

  // Keep only last 10 messages
  const limitedMessages = messages.slice(-10)

  const updatedHistory = {
    ...state.chatHistory,
    [chatId]: {
      messages: limitedMessages,
      createdAt: existingHistory?.createdAt || new Date().toISOString(),
    },
  }

  // Keep only the most recent 10 chats to prevent localStorage from growing too large
  const sortedChats = Object.entries(updatedHistory)
    .sort(
      ([, a], [, b]) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 10)

  const limitedHistory = Object.fromEntries(sortedChats)

  usePersistentDocsState.setState({
    chatHistory: limitedHistory,
  })
}

// Load chat messages for a specific chatId
export function loadChatMessages(chatId: string): UIMessage[] {
  const state = usePersistentDocsState.getState()
  return state.chatHistory[chatId]?.messages || []
}

// Update file content in docs editor and notify parent window
export function updateFileInDocsEditor(githubPath: string, content: string) {
  const updatedFile = {
    content,
    githubPath,
  }

  // Update local state
  useDocsState.setState((state) => ({
    ...state,
    filesInDraft: {
      ...state.filesInDraft,
      [githubPath]: updatedFile,
    },
  }))

  // Send message to parent window if we're in an iframe - only send the changed file in state shape
  if (typeof window !== 'undefined' && window.parent !== window) {
    const message: IframeRpcMessage = {
      id: generateChatId(),
      state: {
        filesInDraft: {
          [githubPath]: updatedFile,
        },
      },
    }
    window.parent.postMessage(message, '*')
  }
}

// Persist and rehydrate persistent docs state
if (typeof window !== 'undefined') {
  window['useDocsState'] = useDocsState

  // Rehydrate from localStorage
  const persistentStateKey = 'holocron-docs-persistent-state'
  const savedState = localStorage.getItem(persistentStateKey)
  if (savedState) {
    try {
      const parsedState = JSON.parse(savedState)
      usePersistentDocsState.setState(parsedState)
    } catch (error) {
      console.warn('Failed to parse saved persistent state:', error)
    }
  }

  // Subscribe to changes and persist to localStorage
  const unsub = usePersistentDocsState.subscribe((state) => {
    localStorage.setItem(persistentStateKey, JSON.stringify(state))
  })

  // Subscribe to highlightedLines changes
  const unsub2 = useDocsState.subscribe((state, prevState) => {
    if (
      state.highlightedLines &&
      state.highlightedLines !== prevState.highlightedLines
    ) {
      highlightText(state.highlightedLines)
    }
  })
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      unsub()
      unsub2()
    })
  }
}

export type IframeRpcMessage = {
  id: string
  state?: Partial<DocsState>
  revalidate?: boolean
  idempotenceKey?: string
  error?: string
}
