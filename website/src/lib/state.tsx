'use client'
import { UIMessage } from 'ai'
import { DocsState } from 'docs-website/src/lib/docs-state'
import { createZustandContext } from 'docs-website/src/lib/zustand-context'
import { create } from 'zustand'
import { useDeferredValue, useMemo } from 'react'
import { FileUpdate } from './edit-tool'

export type State = {
    messages: UIMessage[]
    docsState?: Pick<DocsState, 'currentSlug' | 'filesInDraft'>
    lastPushedFiles: Record<string, FileUpdate>
    isChatGenerating?: boolean
    lastError?: {
        messageId: string
        error: string
        userInput: string
    }
    editingMessageId?: string
}

export const [StateProvider, useChatState] = createZustandContext<State>(
    (initial) => create((set) => ({ ...initial })),
)

export function useFilesInDraftChanges() {
    const currentFilesInDraft = useChatState(
        (x) => x.docsState?.filesInDraft || {},
    )
    const initialFilesInDraft = useChatState((x) => x.lastPushedFiles || {})

    // Use deferred value for better performance
    const deferredFilesInDraft = useDeferredValue(currentFilesInDraft)

    const hasUnsavedChanges = useMemo(() => {
        const currentKeys = Object.keys(deferredFilesInDraft)
        const initialKeys = Object.keys(initialFilesInDraft)

        // Quick check for different number of files
        if (currentKeys.length !== initialKeys.length) {
            return true
        }

        // Check if any file has changed
        return currentKeys.some((key) => {
            const current = deferredFilesInDraft[key]
            const initial = initialFilesInDraft[key]

            // If file doesn't exist in initial state, it's a change
            if (!initial) {
                return true
            }

            // Compare content or other relevant properties
            return (
                current.content !== initial.content ||
                current.addedLines !== initial.addedLines ||
                current.deletedLines !== initial.deletedLines
            )
        })
    }, [deferredFilesInDraft, initialFilesInDraft])

    return {
        currentFilesInDraft,
        deferredFilesInDraft,
        initialFilesInDraft,
        hasUnsavedChanges,
    }
}
