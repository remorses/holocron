import { UIMessage } from 'ai'
import * as Ariakit from '@ariakit/react'
import { create } from 'zustand'

import { createContext, useContext, useMemo } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import { ComboboxStore } from '@ariakit/react'

const ChatContext = createContext<UseBoundStore<StoreApi<ChatState>> | null>(
    null,
)

const ChatProvider = (props: {
    children?: React.ReactNode
    initialValue: Partial<ChatState>
}) => {
    const mentionsCombobox = Ariakit.useComboboxStore()

    const store = useMemo(() => {
        let store = create<ChatState>(() => ({
            messages: [],
            mentionsCombobox,
            ...props.initialValue,
        }))
        Object.assign(useChatState, store)
        return store
    }, [props.initialValue])

    return (
        <ChatContext.Provider value={store}>
            {props.children}
        </ChatContext.Provider>
    )
}

const useChatState = ((
    selector: Parameters<UseBoundStore<StoreApi<ChatState>>>[0],
) => {
    const store = useContext(ChatContext)
    if (store === null) {
        console.error('Missing provider for context:', ChatContext)
        throw new Error('Missing provider for context')
    }
    return store(selector)
}) as UseBoundStore<StoreApi<ChatState>>

export type ChatState = {
    messages: UIMessage[]
    text?: string
    isGenerating?: boolean
    mentionsCombobox: ComboboxStore
    // autocompleteSuggesions?: string[]
    selectedAutocompleteText?: string
    assistantErrorMessage?: string
    editingMessageId?: string
}

export { ChatProvider, useChatState }
