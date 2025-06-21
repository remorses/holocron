import React, { RefObject, useEffect, useRef } from 'react'
import { toast } from 'sonner'

export function useThrowingFn({
    fn: fnToWrap,
    successMessage = '',
    immediate = false,
}) {
    const [isLoading, setIsLoading] = React.useState(false)
    useEffect(() => {
        if (immediate) {
            fn()
        }
    }, [immediate])
    const fn = async function wrappedThrowingFn(...args) {
        try {
            setIsLoading(true)
            const result = await fnToWrap(...args)
            if (result?.skipToast) {
                return result
            }
            if (successMessage) {
                toast.success(successMessage)
            }

            return result
        } catch (err) {
            console.error(err)
            // how to handle unreadable errors? simply don't return them from APIs, just return something went wrong
            if (err instanceof Error && !err?.['skipToast']) {
                toast.error(err.message, {})
                return err
            }
            return err
        } finally {
            setIsLoading(false)
        }
    }

    return {
        isLoading,
        fn,
    }
}

export function useDebouncedEffect(
    effect: () => void | (() => void),
    deps: any[],
    delay: number,
) {
    useEffect(() => {
        const handler = setTimeout(() => {
            effect()
        }, delay)

        return () => {
            clearTimeout(handler)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [...deps, delay])
}

export function useClickOutside<T extends HTMLElement>(
    ref: RefObject<T | null>,
    onAway: (e: MouseEvent | TouchEvent) => void,
) {
    useEffect(() => {
        const listener = (e: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(e.target as Node)) return
            onAway(e)
        }

        document.addEventListener('mousedown', listener)
        document.addEventListener('touchstart', listener)

        return () => {
            document.removeEventListener('mousedown', listener)
            document.removeEventListener('touchstart', listener)
        }
    }, [ref, onAway])
}

export function useTemporaryState<T>(
    defaultValue: T,
    resetAfter: number,
): [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = React.useState(defaultValue)
    const timeoutId = React.useRef<number>(undefined)

    React.useEffect(() => {
        // if the state is not the default value, set a timeout to reset it
        if (state !== defaultValue) {
            timeoutId.current = window.setTimeout(() => {
                setState(defaultValue)
            }, resetAfter)
        }
        // when the component unmounts, clear the timeout
        return () => {
            if (timeoutId.current) {
                clearTimeout(timeoutId.current)
            }
        }
    }, [state, defaultValue, resetAfter])

    const customSetState: React.Dispatch<React.SetStateAction<T>> = (
        newState,
    ) => {
        // when we set a new state, we should clear the previous timeout
        if (timeoutId.current) {
            clearTimeout(timeoutId.current)
        }
        setState(newState)
    }

    return [state, customSetState]
}
