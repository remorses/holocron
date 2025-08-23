'use client'

import { type ReactNode, useSyncExternalStore } from 'react'

export function ClientOnly({ children }: { children: ReactNode }) {
    const isClient = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    )

    return isClient ? children : null
}