import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useDocsState } from './docs-state'

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
        return () => {
            window.removeEventListener('message', onParentPostMessage)
        }
    }, [onParentPostMessage])
}
