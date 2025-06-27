import { useEffect, useMemo, useRef, useState } from 'react'
import { Route } from '../root'
import { useLoaderData, useNavigate, useRouteLoaderData } from 'react-router'
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
/**
 * This hook sets up a window 'message' event listener using the provided handler function.
 * It will automatically remove the listener when the component is unmounted or handler changes.
 * Additionally, it sends a 'ping' postMessage to the parent window every second.
 */
export function useParentPostMessage(
    onParentPostMessage: (event: MessageEvent) => void,
) {
    useEffect(() => {
        window.addEventListener('message', onParentPostMessage)
        if (typeof window !== 'undefined' && window.parent) {
            window.parent?.postMessage?.(
                { type: 'ready' },
                {
                    targetOrigin: '*',
                },
            )
        }

        // Set up ping interval
        const pingInterval = setInterval(() => {
            if (typeof window !== 'undefined' && window.parent) {
                window.parent?.postMessage?.(
                    { type: 'ping' },
                    {
                        targetOrigin: '*',
                    },
                )
            }
        }, 500)

        return () => {
            window.removeEventListener('message', onParentPostMessage)
            clearInterval(pingInterval)
        }
    }, [onParentPostMessage])
}
export function useDocsJson(): DocsJsonType {
    const { branch } = useRouteLoaderData('root') as Route.ComponentProps['loaderData']

    // Check for state overrides for docsJson
    const docsJsonString = useDocsState(
        (state) => state.filesInDraft['docs.json']?.content,
    )

    // Parse docsJsonString if present using useMemo for efficiency
    const docsJson = useMemo(() => {
        if (docsJsonString) {
            try {
                return JSON.parse(docsJsonString)
            } catch (e) {
                console.error('Failed to parse docsJson from state', e)
                return branch.docsJson
            }
        }
        return branch.docsJson || {}
    }, [docsJsonString, branch])
    return docsJson
}
