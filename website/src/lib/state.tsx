'use client'
import { UIMessage } from 'ai'
import { DocsState } from 'docs-website/src/lib/docs-state'
import { createZustandContext } from 'docs-website/src/lib/zustand-context'
import { create } from 'zustand'
import { useDeferredValue, useMemo } from 'react'
import { FileUpdate } from 'docs-website/src/lib/edit-tool'
import { FileSystemEmulator } from './file-system-emulator'

export type State = {
    currentSlug: string
    filesInDraft: DocsState['filesInDraft']

    lastPushedFiles: Record<string, FileUpdate>
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
