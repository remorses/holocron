'use client'
import { UIMessage } from 'ai'
import { DocsState } from 'docs-website/src/lib/docs-state'
import { createZustandContext } from 'docs-website/src/lib/zustand-context'
import { create } from 'zustand'
import { FileUpdate } from './edit-tool'

export type State = {
    messages: UIMessage[]
    docsState?: Pick<DocsState, 'currentSlug' | 'filesInDraft'>
    isChatGenerating?: boolean

    lastError?: {
        messageId: string
        error: string
        userInput: string
    }
    editingMessageId?: string
}

export const [StateProvider, useChatState] = createZustandContext<State>(
    (initial) => create((set) => ({ ...initial })),
)
