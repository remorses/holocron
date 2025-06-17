'use client'
import type { PageTree, TOCItemType } from 'fumadocs-core/server'

import { createZustandContext } from 'docs-website/src/lib/zustand-context'
import { create } from 'zustand'

export type State = {
    tree: PageTree.Root
    updatedPages: Map<
        string,
        {
            markdown: string
            slug: string
            ast: any
            toc: TOCItemType[]
        }
    >
    deletedPages: Array<{
        slug: string
    }>
}

export const [DocsStateProvider, useDocsState] = createZustandContext<State>(
    (initial) => create((set) => ({ ...initial })),
)
