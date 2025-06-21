'use client'
import type { PageTree, TOCItemType } from 'fumadocs-core/server'

import { create } from 'zustand'

export type DocsState = {
    tree?: PageTree.Root
    toc?: TOCItemType[]
    currentSlug?: string
    filesInDraft: Record<
        string,
        {
            content: string
            githubPath: string
            addedLines: number
            deletedLines: number
        }
    >
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

export type IframeRpcMessage = {
    id: string
    state?: DocsState
    error?: string
}
