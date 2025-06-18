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

/**
 * This hook navigates to the docs state current slug if it changes,
 * to sync with parent window state.
 */
export function usSyncWithDocsStateSlug() {
    const navigate = useNavigate()
    const currentSlug = useDocsState((state) => state.currentSlug)

    const [prevSlug, setPrevSlug] = useState<string | undefined>(currentSlug)

    useEffect(() => {
        if (currentSlug && currentSlug !== prevSlug) {
            navigate(currentSlug)
            setPrevSlug(currentSlug)
        }
    }, [currentSlug, prevSlug])
}

export function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T>(undefined)

    useEffect(() => {
        if (!value) return
        ref.current = value
    }, [value])

    return ref.current
}
