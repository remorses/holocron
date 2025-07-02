'use client'
import type { PageTree, TOCItemType } from 'fumadocs-core/server'

import { create } from 'zustand'

export type FilesInDraft = Record<
    string,
    {
        content: string
        githubPath: string
        addedLines?: number
        deletedLines?: number
    } | null
>
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

export const useDocsState = create<DocsState>(() => defaultState)


if (typeof window !== 'undefined') {
    window['useDocsState'] = useDocsState
}

export type IframeRpcMessage = {
    id: string
    state?: DocsState
    error?: string
}
