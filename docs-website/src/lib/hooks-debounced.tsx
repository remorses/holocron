import { useEffect, useRef } from 'react'

/**
 * Debounced effect hook that delays execution until after a specified delay
 * and only executes if the revalidator is idle
 */
export function useDebouncedEffect(
    effect: () => void,
    deps: React.DependencyList,
    delay: number,
    shouldRun: boolean = true
) {
    const timeoutRef = useRef<NodeJS.Timeout>(undefined)

    useEffect(() => {
        if (!shouldRun) {
            return
        }

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }

        // Set new timeout
        timeoutRef.current = setTimeout(effect, delay)

        // Cleanup on unmount or deps change
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [...deps, shouldRun])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
        }
    }, [])
}