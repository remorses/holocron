'use client'

import { useLayoutEffect, useRef, RefObject } from 'react'

export const useScrollToFirstAddedIfAtTop = ({
    root,
    enabled,
}: {
    root?: RefObject<HTMLElement | null>
    enabled?: boolean
} = {}) => {
    // Every render, check scroll position and scroll to first data-added if at top
    useLayoutEffect(() => {
        const isEnabled = enabled ?? true
        if (!isEnabled) return

        const host = root?.current ?? document.documentElement

        if (!host) return

        const scrollable = document.scrollingElement || document.documentElement
        const isAtTop = scrollable.scrollTop <= 1 // Accept 1px margin

        if (!isAtTop) return

        const first = host.querySelector<HTMLElement>('[data-added]')
        if (!first) return

        const rect = first.getBoundingClientRect()
        // Check if element is not fully in view vertically
        const inView =
            rect.top >= 0 &&
            rect.bottom <=
                (window.innerHeight || document.documentElement.clientHeight)

        if (!inView) {
            first.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    })
}

export const useAddedHighlighter = ({
    root,
    enabled = true,
}: {
    root: RefObject<HTMLElement | null>
    enabled?: boolean
}): void => {
    const hlRef = useRef<Highlight | null>(null)

    useLayoutEffect(() => {
        if (!enabled) return

        const host = root.current
        if (!host || !CSS.highlights) return

        /* collect all added nodes except opt-outs */
        const added: HTMLElement[] = Array.from(
            host.querySelectorAll<HTMLElement>(
                '[data-added]:not([data-no-highlight])',
            ),
        )

        if (!added.length) return

        const ranges = added.map((el) => {
            const r = document.createRange()
            r.selectNodeContents(el)
            return r
        })

        const hl = hlRef.current ?? new window.Highlight()
        ranges.forEach((r) => hl.add(r))
        CSS.highlights.set('md-add', hl)
        hlRef.current = hl

        return () => {
            /* optional cleanup on unmount */
            CSS.highlights.delete('md-add')
            hlRef.current = null
        }
    })
}
