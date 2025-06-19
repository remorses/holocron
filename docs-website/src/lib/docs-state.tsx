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
    updatedPages: Record<
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
    updatedPages: {},
    deletedPages: [],
}

export const useDocsState = create<DocsState>(() => defaultState)

// Initialize state from idb-keyval when available
if (typeof window !== 'undefined') {
    get<DocsState>(stateKey).then((savedState) => {
        if (savedState) {
            useDocsState.setState(savedState)
        }
    })
}

const storeState = debounce(500, async (state: DocsState) => {
    const toStore: DocsState = {
        updatedPages: state.updatedPages,
        deletedPages: state.deletedPages,
        tree: state.tree,
        toc: state.toc,
    }
    await set(stateKey, toStore)
})
if (typeof window !== 'undefined') {
    const unsub = useDocsState.subscribe(storeState)
    if (import.meta.hot) {
        import.meta.hot.dispose(() => {
            unsub()
        })
    }
}

export type IframeRpcMessage = {
    id: string
    state?: DocsState
    error?: string
}
