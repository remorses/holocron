'use client'
import type { PageTree, TOCItemType } from 'fumadocs-core/server'

import { createZustandContext } from 'docs-website/src/lib/zustand-context'
import { create } from 'zustand'
import { env } from './env'
import { debounce } from './utils'
import { get, set } from 'idb-keyval'
import { startTransition } from 'react'

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

const stateKey = 'docsState'

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
