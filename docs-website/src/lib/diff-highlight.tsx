import { useLayoutEffect, useRef, RefObject } from 'react'
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
