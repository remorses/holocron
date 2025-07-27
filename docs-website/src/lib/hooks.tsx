'use client'

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react'
import JSONC from 'tiny-jsonc'
import { Route } from '../routes/_catchall'
import { useLoaderData, useRouteLoaderData } from 'react-router'
import { useDocsState } from './docs-state'
import { DocsJsonType } from './docs-json'

export function useDebounce<T>(value: T, delayMs = 1000): T {
    const [debouncedValue, setDebouncedValue] = useState(value)
    const timer = useRef<{ value: T; handler: number }>(undefined)

    if (delayMs === 0) return value

    if (value !== debouncedValue && timer.current?.value !== value) {
        if (timer.current) clearTimeout(timer.current.handler)

        const handler = window.setTimeout(() => {
            setDebouncedValue(value)
        }, delayMs)
        timer.current = { value, handler }
    }

    return debouncedValue
}

export function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T>(undefined)

    useEffect(() => {
        if (!value) return
        ref.current = value
    }, [value])

    return ref.current
}
export function useDocsJson(): DocsJsonType {
    const { docsJson } =
        (useRouteLoaderData('routes/_catchall') as Route.ComponentProps['loaderData']) || {}

    // Check for state overrides for docsJson
    const docsJsonString = useDocsState((state) => {
        const key = Object.keys(state.filesInDraft).find((k) =>
            k.endsWith('fumabase.jsonc'),
        )
        return key ? state.filesInDraft[key]?.content : undefined
    })

    // Parse docsJsonString if present using useMemo for efficiency
    return useMemo(() => {
        if (docsJsonString) {
            try {
                return JSONC.parse(docsJsonString)
            } catch (e) {
                console.error('Failed to parse docsJson from state', e)
                return docsJson
            }
        }
        return docsJson || {}
    }, [docsJsonString, docsJson])
}

const fn = (callback: any) => {
    return () => {}
}
export function useHydrated() {
    return useSyncExternalStore(
        fn,
        () => true, // client snapshot
        () => false, // server snapshot (always false)
    )
}
