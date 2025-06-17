'use client'
import { UIMessage } from 'ai'
import { DocsState } from 'docs-website/src/lib/docs-state'
import { createZustandContext } from 'docs-website/src/lib/zustand-context'
import { create } from 'zustand'

export type State = {
    messages: UIMessage[]
    docsState?: DocsState
    isChatGenerating?: boolean

}

export const [StateProvider, useChatState] = createZustandContext<State>(
    (initial) => create((set) => ({ ...initial })),
)
