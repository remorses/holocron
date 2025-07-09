'use client'
import type { PageTree, TOCItemType } from 'fumadocs-core/server'

import { create } from 'zustand'
import { createIdGenerator } from 'ai'

const generateId = createIdGenerator()
function generateChatId(): string {
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

export type PersistentDocsState = {
    chatId: string
}

export type DocsState = {
    // tree?: PageTree.Root
    toc?: TOCItemType[]
    isChatOpen?: boolean
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
}

export const useDocsState = create<DocsState>(() => defaultState)

export const usePersistentDocsState = create<PersistentDocsState>(
    () => defaultPersistentState,
)

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
