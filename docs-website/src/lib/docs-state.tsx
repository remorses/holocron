'use client'
import type { PageTree } from 'fumadocs-core/server'

import { createZustandContext } from 'docs-website/src/lib/zustand-context'
import { create } from 'zustand'

export type State = {
    tree: PageTree.Root
}

export const [DocsStateProvider, useDocsState] = createZustandContext<State>(
    (initial) => create((set) => ({ ...initial })),
)
