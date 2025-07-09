'use client'
import type { PageTree, TOCItemType } from 'fumadocs-core/server'

import { create } from 'zustand'
import { createIdGenerator, UIMessage } from 'ai'

const generateId = createIdGenerator()
export function generateChatId(): string {
    return generateId()
}

export type FilesInDraft = Record<
    string,
    {
        content: string
        githubPath: string
        addedLines?: number
        deletedLines?: number
    } | null
>

export type ChatHistory = {
    messages: UIMessage[]
    createdAt: string
}

export type PersistentDocsState = {
    chatId: string
    isChatOpen: boolean
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
}

const defaultState: DocsState = {
    filesInDraft: {},
    deletedPages: [],
}

const defaultPersistentState: PersistentDocsState = {
    chatId: generateChatId(),
    isChatOpen: false,
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
        .sort(([, a], [, b]) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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

// Persist and rehydrate persistent docs state
if (typeof window !== 'undefined') {
    window['useDocsState'] = useDocsState

    // Rehydrate from localStorage
    const persistentStateKey = 'fumabase-docs-persistent-state'
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
    usePersistentDocsState.subscribe((state) => {
        localStorage.setItem(persistentStateKey, JSON.stringify(state))
    })
}

export type IframeRpcMessage = {
    id: string
    state?: DocsState
    error?: string
}
