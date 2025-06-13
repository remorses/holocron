'use client'
import { UIMessage } from 'ai'
import { createContext, useContext } from 'react'
import { ExtractState, StoreApi, create, createStore, useStore } from 'zustand'
import { UseBoundStore } from 'zustand/react'

export type State = {
    messages: UIMessage[]
    isChatGenerating?: boolean
}

export const chatStateContainer: {
    current: UseBoundStore<StoreApi<State>> | null
} = {
    current: null,
}

export function useChatState<U>(
    selector: (state: ExtractState<StoreApi<State>>) => U,
) {
    const useStore = useContext(zustandContext)
    if (!useStore) {
        throw new Error('useChatState must be used within a StateProvider')
    }
    return useStore(selector)
}

export const zustandContext = createContext<
    UseBoundStore<StoreApi<State>> | undefined
>(undefined)
