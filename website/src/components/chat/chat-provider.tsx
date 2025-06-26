import { UIMessage } from 'ai'
import { create } from 'zustand'

import { createContext, useContext, useMemo } from 'react'
import type { StoreApi, UseBoundStore } from 'zustand'

export const createZustandContext = <TInitial,>(
    getStore: (initial: TInitial) => UseBoundStore<StoreApi<TInitial>>,
) => {
    type TStore = UseBoundStore<StoreApi<TInitial>>
    const Context = createContext<TStore | null>(null)

    const Provider = (props: {
        children?: React.ReactNode
        initialValue: TInitial
    }) => {
        const store = useMemo(() => {
            let store = getStore(props.initialValue)
            Object.assign(useStore, store)
            return store
        }, [props.initialValue])

        return (
            <Context.Provider value={store}>{props.children}</Context.Provider>
        )
    }

    const useStore = ((selector: Parameters<TStore>[0]) => {
        const store = useContext(Context)
        if (store === null) {
            console.error('Missing provider for context:', Context)
            throw new Error('Missing provider for context')
        }
        return store(selector)
    }) as TStore

    return [Provider, useStore] as const
}

export type ChatState = {
    messages: UIMessage[]
    isChatGenerating?: boolean
    assistantErrorMessage?: string
    editingMessageId?: string
}

export const [ChatProvider, useChatState] = createZustandContext<ChatState>(
    (initial) => create((set) => ({ ...initial })),
)
