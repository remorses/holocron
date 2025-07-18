import { createIdGenerator, UIMessage } from 'ai'
import * as Ariakit from '@ariakit/react'
import { create } from 'zustand'
import { createContext, useContext, useMemo, useEffect, useRef } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import { ComboboxStore } from '@ariakit/react'

const ChatContext = createContext<UseBoundStore<StoreApi<ChatState>> | null>(
    null,
)

const DRAFT_MESSAGE_KEY = 'contesto-chat-draft'

const ChatProvider = (props: {
    children?: React.ReactNode
    generateMessages?: (x: {
        abortController: AbortController
    }) => Promise<void>
    initialValue: Partial<ChatState>
}) => {
    const mentionsCombobox = Ariakit.useComboboxStore()

    const store = useMemo(() => {
        const abortController = new AbortController()
        let store = create<ChatState>(() => ({
            messages: [],
            submitForm() {
                return onSubmit()
            },
            abortController,
            mentionsCombobox,
            ...props.initialValue,
        }))
        Object.assign(useChatState, store)
        return store
    }, [props.initialValue])
    useEffect(() => {
        const handleChatRegenerate = () => {
            // Generate a new assistant response
            onSubmit()
        }

        window.addEventListener('chatRegenerate', handleChatRegenerate)
        return () => {
            window.removeEventListener('chatRegenerate', handleChatRegenerate)
        }
    }, [onSubmit])
    async function onSubmit() {
        const generateId = createIdGenerator()
        const assistantMessageId = generateId()
        const userMessageId = generateId()
        const now = new Date()
        const { text: value = '', messages } = useChatState.getState()
        if (!value.trim()) {
            // For regenerate, use existing messages and just add new assistant message
            useChatState.setState({
                messages: [
                    ...messages,
                    {
                        parts: [],
                        role: 'assistant',
                        id: assistantMessageId,
                    },
                ],
            })
        } else {
            // Create user message for new requests
            const userMessage: UIMessage = {
                id: userMessageId,
                role: 'user',
                parts: [{ type: 'text', text: value }],
            }

            useChatState.setState({
                messages: [
                    ...messages,
                    userMessage,
                    {
                        parts: [],
                        role: 'assistant',
                        id: assistantMessageId,
                    },
                ],
            })
            useChatState.setState({ text: '' })
        }
        useChatState.setState({
            isGenerating: true,
            assistantErrorMessage: undefined,
        })

        try {
            const abortController = useChatState.getState().abortController
            await props.generateMessages?.({ abortController })
        } catch (error) {
            // Remove only the failed assistant message, keep user message
            const currentMessages = useChatState.getState().messages || []
            let messagesWithoutAssistant = currentMessages.slice(0, -1)
            useChatState.setState({
                messages: messagesWithoutAssistant,
                assistantErrorMessage:
                    error instanceof Error
                        ? error.message
                        : 'An unexpected error occurred',
            })
        } finally {
            useChatState.setState({
                isGenerating: false,
                abortController: new AbortController(),
            })
            window.dispatchEvent(new CustomEvent('chatGenerationFinished', {}))
        }
    }

    useEffect(() => {
        const handleChatRegenerate = () => {
            // Generate a new assistant response
            onSubmit()
        }

        window.addEventListener('chatRegenerate', handleChatRegenerate)
        return () => {
            window.removeEventListener('chatRegenerate', handleChatRegenerate)
        }
    }, [onSubmit])

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
        <form
            style={{ display: 'contents' }}
            onSubmit={(e) => {
                e.preventDefault()
                onSubmit()
            }}
        >
            <ChatContext.Provider value={store}>
                {props.children}
            </ChatContext.Provider>
        </form>
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
    submitForm: () => any
    abortController: AbortController
    isGenerating?: boolean
    mentionsCombobox: ComboboxStore
    selectedAutocompleteText?: string
    assistantErrorMessage?: string
    editingMessageId?: string
}

export { ChatProvider, useChatState }
