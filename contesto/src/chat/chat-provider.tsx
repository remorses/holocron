import { createIdGenerator, UIMessage } from 'ai'
import { useShallow } from 'zustand/react/shallow'

import { createTrackedSelector } from 'react-tracked'

import * as Ariakit from '@ariakit/react'
import { create } from 'zustand'
import { createContext, useContext, useMemo, useEffect, useRef } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import { ComboboxStore } from '@ariakit/react'
import { cn } from '../lib/cn.js'

const ChatContext = createContext<UseBoundStore<StoreApi<ChatState>> | null>(
    null,
)

import { shallow } from 'zustand/shallow'
import { flushSync } from 'react-dom'

function useShallowStable<T>(value: T): T {
    const ref = useRef(value)
    if (!shallow(ref.current, value)) ref.current = value
    return ref.current
}

const DRAFT_MESSAGE_KEY = 'contesto-chat-draft'

const ChatProvider = (props: {
    children?: React.ReactNode
    generateMessages?: (x: ChatState) => Promise<void>
    initialValue: Partial<ChatState>
    className?: string
}) => {
    const mentionsCombobox = Ariakit.useComboboxStore()
    const stableInitialState = useShallowStable(props.initialValue)
    const store = useMemo(() => {
        const abortController = new AbortController()
        let store = create<ChatState>(() => ({
            messages: [],
            submit() {
                return submit()
            },
            stop() {
                store.getState().abortController.abort('stop generation')
            },
            setDraftText(text) {
                store.setState({ draftText: text })
            },
            setMessages(messages) {
                store.setState({ messages })
            },
            abortController,
            mentionsCombobox,
            ...props.initialValue,
        }))
        Object.assign(useChatState, store)
        return store
    }, [stableInitialState])
    useEffect(() => {
        const handleChatRegenerate = () => {
            // Generate a new assistant response
            submit()
        }

        window.addEventListener('chatRegenerate', handleChatRegenerate)
        return () => {
            window.removeEventListener('chatRegenerate', handleChatRegenerate)
        }
    }, [submit])
    async function submit() {
        const generateId = createIdGenerator()
        const assistantMessageId = generateId()
        const userMessageId = generateId()
        const now = new Date()
        const {
            draftText: value = '',
            messages,
            isGenerating,
        } = store.getState()
        if (isGenerating) {
            return
        }
        if (!value.trim()) {
            store.setState({
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

            flushSync(() => {
                store.setState({
                    messages: [
                        ...messages,
                        userMessage,
                        {
                            parts: [],
                            role: 'assistant',
                            id: assistantMessageId,
                        },
                    ],
                    draftText: '',
                })
            })

            const messageElement = document.querySelector(
                `[data-message-id="${userMessageId}"]`,
            )
            if (messageElement) {
                messageElement.scrollIntoView({
                    behavior: 'smooth',
                })
            }
        }

        store.setState({
            isGenerating: true,
            assistantErrorMessage: undefined,
        })

        try {
            await props.generateMessages?.(useChatState.getState())
        } catch (error) {
            console.error('Error during message generation:', error)
            // Remove only the failed assistant message, keep user message
            const currentMessages = store.getState().messages || []
            let messagesWithoutAssistant = currentMessages.slice(0, -1)
            store.setState({
                messages: messagesWithoutAssistant,
                assistantErrorMessage:
                    error instanceof Error
                        ? error.message
                        : 'An unexpected error occurred',
            })
        } finally {
            store.setState({
                isGenerating: false,
                abortController: new AbortController(),
            })
            window.dispatchEvent(new CustomEvent('chatGenerationFinished', {}))
        }
    }

    useEffect(() => {
        const handleChatRegenerate = () => {
            submit()
        }

        window.addEventListener('chatRegenerate', handleChatRegenerate)
        return () => {
            window.removeEventListener('chatRegenerate', handleChatRegenerate)
        }
    }, [submit])

    useEffect(() => {
        // Load initial text from localStorage if not provided in props
        if (!props.initialValue.draftText) {
            const savedDraft = localStorage.getItem(DRAFT_MESSAGE_KEY)
            if (savedDraft) {
                store.setState({ draftText: savedDraft })
            }
        }

        // Subscribe to text changes and persist to localStorage
        const unsubscribe = store.subscribe((state, prevState) => {
            if (state.draftText !== prevState.draftText) {
                if (state.draftText) {
                    localStorage.setItem(DRAFT_MESSAGE_KEY, state.draftText)
                } else {
                    localStorage.removeItem(DRAFT_MESSAGE_KEY)
                }
            }
        })

        return unsubscribe
    }, [store, props.initialValue.draftText])

    return (
        <ChatContext.Provider value={store}>
            {props.children}
        </ChatContext.Provider>
    )
}

export let useChatContext = () => {
    const store = useContext(ChatContext)
    if (store === null) {
        console.error('Missing provider for context:', ChatContext)
        throw new Error('Missing provider for context')
    }
    const trackedSelector = useMemo(() => createTrackedSelector(store), [store])
    return trackedSelector()
}

let useChatState = ((
    selector: Parameters<UseBoundStore<StoreApi<ChatState>>>[0],
) => {
    const store = useContext(ChatContext)
    if (store === null) {
        throw new Error('Missing provider for chat context')
    }
    return store(selector)
}) as UseBoundStore<StoreApi<ChatState>>

export type ChatState = {
    messages: UIMessage[]
    draftText?: string
    setDraftText: (text: string) => void
    submit: () => Promise<any>
    stop: () => void
    setMessages: (messages: UIMessage[]) => void
    abortController: AbortController
    isGenerating?: boolean
    mentionsCombobox: ComboboxStore
    selectedAutocompleteText?: string
    assistantErrorMessage?: string
    editingMessageId?: string
}

export { ChatProvider, useChatState }
