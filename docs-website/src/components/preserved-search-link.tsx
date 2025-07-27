import { ComponentProps } from 'react'
import { Link, useNavigate, useSearchParams, To, NavigateOptions } from 'react-router'

export function PreservedSearchLink({ to, ...props }: ComponentProps<typeof Link>) {
    const [searchParams] = useSearchParams()
    const currentSearch = searchParams.toString()

    const getPreservedSearchTo = (): To => {
        if (typeof to === 'string') {
            const separator = to.includes('?') ? '&' : '?'
            return currentSearch ? `${to}${separator}${currentSearch}` : to
        }

        if (typeof to === 'object' && to !== null && 'pathname' in to) {
            return {
                ...to,
                search: to.search
                    ? `${to.search}&${currentSearch}`
                    : currentSearch ? `?${currentSearch}` : undefined,
            }
        }

        return to
    }

    return <Link to={getPreservedSearchTo()} {...props} />
}


export const usePreservedNavigate = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const currentSearch = searchParams.toString()

    return (to: To | number, options?: NavigateOptions) => {
        if (typeof to === 'number') {
            return navigate(to)
        }

        if (typeof to === 'string') {
            const separator = to.includes('?') ? '&' : '?'
            const preservedTo = currentSearch ? `${to}${separator}${currentSearch}` : to
            return navigate(preservedTo, options)
        }

        if (typeof to === 'object' && to !== null && 'pathname' in to) {
            const preservedTo = {
                ...to,
                search: to.search
                    ? `${to.search}&${currentSearch}`
                    : currentSearch ? `?${currentSearch}` : undefined,
            }
            return navigate(preservedTo, options)
        }

        return navigate(to, options)
    }
}

// Global navigate function that preserves search params
type GlobalNavigateFunction = (to: string | number, options?: NavigateOptions) => void

export let globalNavigate: GlobalNavigateFunction = (to, options) => {
    if (typeof to === 'number') {
        window.history.go(to)
        return
    }

    // Fallback: preserve search params manually with window.location
    const currentSearch = window.location.search
    if (currentSearch && typeof to === 'string' && !to.includes('?')) {
        const separator = '?'
        window.location.href = `${to}${separator}${currentSearch.slice(1)}`
    } else {
        window.location.href = to
    }
}

// This should be called in the root component to set the proper navigate function
export function setGlobalNavigate(navigateFn: GlobalNavigateFunction) {
    globalNavigate = navigateFn
}
