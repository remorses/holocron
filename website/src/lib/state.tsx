'use client'
import { UIMessage } from 'ai'
import { DocsState } from 'docs-website/src/lib/docs-state'
import { createZustandContext } from 'docs-website/src/lib/zustand-context'
import { create } from 'zustand'
import { useDeferredValue, useMemo, useEffect, useRef } from 'react'
import { FileUpdate } from 'docs-website/src/lib/edit-tool'
import { FileSystemEmulator } from './file-system-emulator'
import { apiClient } from './spiceflow-client'

export type State = {
    currentSlug: string
    filesInDraft: DocsState['filesInDraft']
    lastPushedFiles: Record<string, FileUpdate>
    filesInDraftNeedSave?: boolean
    isChatGenerating?: boolean
}

export const [WebsiteStateProvider, useWebsiteState] =
    createZustandContext<State>((initial) => create((set) => ({ ...initial })))

if (typeof window !== 'undefined') {
    window['useWebsiteState'] = useWebsiteState
}


// TODO this does not handle files deletions
export function doFilesInDraftNeedPush(
    currentFilesInDraft: Record<string, FileUpdate>,
    lastPushedFiles: Record<string, FileUpdate>,
) {
    // Use trimmed content comparison as before
    const hasNonPushedChanges = Object.keys(currentFilesInDraft).some((key) => {
        const current = currentFilesInDraft[key]
        const initial = lastPushedFiles[key]

        // Compare content or other relevant properties, trim before comparing content
        const currentContent = (current?.content ?? '').trim()
        const initialContent = (initial?.content ?? '').trim()

        const different = currentContent !== initialContent
        if (different) {
            const diffLen = Math.abs(
                currentContent.length - initialContent.length,
            )
            // You might want to log more details depending on your needs
            // For now, we log the key, what changed, and by how many characters
            console.log(
                `[doFilesInDraftNeedPush] File "${key}" is different: length changed by ${diffLen} (was ${initialContent.length}, now ${currentContent.length})`,
            )
        }
        return different
    })

    return hasNonPushedChanges
}

// Hook to handle debounced saving of filesInDraft to database
export function useFilesInDraftAutoSave(chatId: string | undefined) {
    const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
    const savingRef = useRef(false)

    useEffect(() => {
        if (!chatId) return

        // Subscribe to filesInDraft changes using Zustand's subscribe
        const unsubscribe = useWebsiteState.subscribe(
            (state, prevState) => {
                // Check if filesInDraft changed
                if (state.filesInDraft !== prevState.filesInDraft) {
                    // Skip if already saving
                    if (savingRef.current) return

                    // Clear existing timeout
                    if (timeoutRef.current) {
                        clearTimeout(timeoutRef.current)
                    }

                    // Set new timeout for debounced save
                    timeoutRef.current = setTimeout(async () => {
                        savingRef.current = true
                        try {
                            const currentFilesInDraft = useWebsiteState.getState().filesInDraft
                            const { data, error } = await apiClient.api.updateChatFilesInDraft.post({
                                chatId,
                                filesInDraft: currentFilesInDraft,
                            })

                            if (error) {
                                console.error('Failed to auto-save filesInDraft:', error)
                            }
                        } catch (error) {
                            console.error('Failed to auto-save filesInDraft:', error)
                        } finally {
                            savingRef.current = false
                        }
                    }, 500) // 300ms debounce
                }
            }
        )

        // Cleanup on unmount
        return () => {
            unsubscribe()
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [chatId])
}
