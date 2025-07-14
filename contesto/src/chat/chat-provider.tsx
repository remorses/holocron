import { UIMessage } from 'ai'
import * as Ariakit from '@ariakit/react'
import { create } from 'zustand'
import { createContext, useContext, useMemo, useEffect } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import { ComboboxStore } from '@ariakit/react'

const ChatContext = createContext<UseBoundStore<StoreApi<ChatState>> | null>(
    null,
)

const DRAFT_MESSAGE_KEY = 'contesto-chat-draft'

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

    useEffect(() => {
        // Load initial text from localStorage if not provided in props
        if (!props.initialValue.text) {
            const savedDraft = localStorage.getItem(DRAFT_MESSAGE_KEY)
            if (savedDraft) {
                store.setState({ text: savedDraft })
            }
        }

        // Subscribe to text changes and persist to localStorage
        const unsubscribe = store.subscribe((state, prevState) => {
            if (state.text !== prevState.text) {
                if (state.text) {
                    localStorage.setItem(DRAFT_MESSAGE_KEY, state.text)
                } else {
                    localStorage.removeItem(DRAFT_MESSAGE_KEY)
                }
            }
        })

        return unsubscribe
    }, [store, props.initialValue.text])

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
    selectedAutocompleteText?: string
    assistantErrorMessage?: string
    editingMessageId?: string
}

export { ChatProvider, useChatState }
