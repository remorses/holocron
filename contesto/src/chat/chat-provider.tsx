import { createIdGenerator, UIMessage, FileUIPart } from 'ai'

import { createTrackedSelector } from 'react-tracked'

import * as Ariakit from '@ariakit/react'
import { create } from 'zustand'
import {
    createContext,
    useContext,
    useMemo,
    useEffect,
    useRef,
    useLayoutEffect,
} from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'
import { ComboboxStore } from '@ariakit/react'

import * as cookie from 'cookie'

const ChatContext = createContext<UseBoundStore<StoreApi<ChatState>> | null>(
    null,
)

import { shallow } from 'zustand/shallow'
import { flushSync } from 'react-dom'
import {
    CONTESTO_DRAFT_MESSAGE_KEY,
    CONTESTO_SUBMIT_ON_LOAD,
} from '../lib/constants.js'

function useShallowStable<T>(value: T): T {
    const ref = useRef(value)
    if (!shallow(ref.current, value)) ref.current = value
    return ref.current
}

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
        abortController.signal.addEventListener('abort', () => {
            console.log('Generation aborted:', abortController.signal.reason)
        })
        let store = create<ChatState>(() => ({
            messages: [],
            submit() {
                return submit()
            },
            stop() {
                // console.trace('stop')
                store
                    .getState()
                    .abortController.abort(
                        'called stop() to stop ai generation',
                    )
            },
            setDraftText(text) {
                store.setState({ draftText: text })
            },
            setMessages(messages) {
                store.setState({ messages })
            },
            abortController,
            mentionsCombobox,
            attachedFiles: [],
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
        let userMessageId = generateId()
        const {
            draftText: draftText = '',
            messages,
            isGenerating,
            attachedFiles = [],
        } = store.getState()
        if (isGenerating) {
            return
        }

        if (!draftText.trim() && attachedFiles.length === 0) {
            const lastUserMessage = [...messages]
                .reverse()
                .find((msg) => msg.role === 'user')
            userMessageId = lastUserMessage?.id || userMessageId
            flushSync(() => {
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
            })
        } else {
            // Create user message for new requests
            const parts: UIMessage['parts'] = []

            // Add text part if there's text
            if (draftText.trim()) {
                parts.push({ type: 'text', text: draftText })
            }

            // Add file parts if there are attached files
            if (attachedFiles.length > 0) {
                parts.push(...attachedFiles)
            }

            const userMessage: UIMessage = {
                id: userMessageId,
                role: 'user',
                parts,
            }

            flushSync(() => {
                store.setState({
                    messages: [
                        ...messages,
                        userMessage,
                        // {
                        //     parts: [],
                        //     role: 'assistant',
                        //     id: assistantMessageId,
                        // },
                    ],
                    draftText: '',
                    attachedFiles: [], // Clear attached files after sending
                })
            })
        }

        requestAnimationFrame(() => {
            const messageElement = document.querySelector(
                `[data-message-id="${userMessageId}"]`,
            )
            if (messageElement) {
                messageElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                })
            } else {
                console.warn(
                    `Message element with id ${userMessageId} not found for scrolling`,
                )
            }
        })

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
    useLayoutEffect(() => {
        console.log(`chat remounted, scrolling into the user message`)
        const messages = stableInitialState.messages || []
        const lastUserMessage = [...messages]
            .reverse()
            .find((msg) => msg.role === 'user')
        const userMessageId = lastUserMessage?.id
        const messageElement = document.querySelector(
            `[data-message-id="${userMessageId}"]`,
        )
        if (messageElement) {
            messageElement.scrollIntoView({
                behavior: 'instant',
                block: 'start',
            })
        } else {
            console.warn(
                `Message element with id ${userMessageId} not found for scrolling initial message`,
            )
        }
    }, [])

    useEffect(() => {
        // Load initial text from cookies if not provided in props
        if (!props.initialValue.draftText) {
            const cookies = cookie.parse(document.cookie)
            const savedDraft = cookies[CONTESTO_DRAFT_MESSAGE_KEY]
            if (savedDraft) {
                const decodedDraft = decodeURIComponent(savedDraft)
                store.setState({ draftText: decodedDraft })
            }
        }

        // If cookies have CONTESTO_SUBMIT_ON_LOAD set to 'true', call submit
        const cookies = cookie.parse(document.cookie)
        if (cookies[CONTESTO_SUBMIT_ON_LOAD] === 'true') {
            submit()
            // Remove the cookie
            document.cookie = cookie.serialize(CONTESTO_SUBMIT_ON_LOAD, '', {
                maxAge: 0,
                path: '/',
            })
        }

        // Subscribe to text changes and persist to cookies
        const unsubscribe = store.subscribe((state, prevState) => {
            if (state.draftText !== prevState.draftText) {
                const encodedDraft = encodeURIComponent(state.draftText || '')
                document.cookie = cookie.serialize(
                    CONTESTO_DRAFT_MESSAGE_KEY,
                    encodedDraft,
                    {
                        path: '/',
                        maxAge: 60 * 60 * 24 * 7, // 7 days
                    },
                )
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
        throw new Error('Missing provider for chat context')
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
    assistantErrorMessage?: string
    setMessages(messages: UIMessage[]): void
    draftText?: string
    setDraftText(text: string): void
    submit(): void
    regenerate?(): void
    isGenerating?: boolean
    status?: 'ready' | 'streaming' | 'submitted' | 'error'
    stop(): void
    abortController: AbortController
    mentionsCombobox?: ComboboxStore
    attachedFiles?: FileUIPart[]
    editingMessageId?: string
    selectedAutocompleteText?: string
}

export { ChatProvider, useChatState }
