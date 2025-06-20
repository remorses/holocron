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
            markdown: string
            githubPath: string
            // ast: any
            // toc: TOCItemType[]
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
