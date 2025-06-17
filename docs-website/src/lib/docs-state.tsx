'use client'
import type { PageTree, TOCItemType } from 'fumadocs-core/server'

import { createZustandContext } from 'docs-website/src/lib/zustand-context'
import { create } from 'zustand'
import { env } from './env'
import { debounce } from './utils'

export type DocsState = {
    tree: PageTree.Root
    toc: TOCItemType[]
    currentSlug?: string
    updatedPages: Record<
        string,
        {
            markdown: string
            githubPath: string
            // ast: any
            // toc: TOCItemType[]
        }
    >
    deletedPages: Array<{
        slug: string
    }>
}

export const [DocsStateProvider, useDocsState] =
    createZustandContext<DocsState>((initial) =>
        create((set) => ({ ...initial })),
    )

export type IframeRpcMessage = {
    id: string
    state?: DocsState
    error?: string
}

const allowedOrigins = [env.NEXT_PUBLIC_URL!.replace(/\/$/, '')]

export const onParentPostMessage = async (e: MessageEvent) => {
    // e.origin is a string representing the origin of the message, e.g., "https://example.com"
    if (!allowedOrigins.includes(e.origin)) {
        console.warn(`Blocked message from disallowed origin: ${e.origin}`)
        return
    }
    const data = e.data as IframeRpcMessage
    const { id, state } = data || {}

    if (state) useDocsState.setState(state)
    e.source!.postMessage({ id } satisfies IframeRpcMessage, {
        targetOrigin: '*',
    })
    // e.source!.postMessage(
    //     {
    //         id,
    //     } satisfies IframeRpcMessage,
    //     { targetOrigin: '*' },
    // )
}
