'use client'

/**
 * TableOfContentsPanel — a lightweight right-sidebar TOC component.
 *
 * Takes NavHeading[] as props and renders a vertical list of heading links
 * with active-state tracking via IntersectionObserver. Designed to be placed
 * inside an <Aside> in MDX for a typical "On this page" sidebar.
 *
 * Inspired by fumadocs base-ui/toc/default.tsx but uses holocron's own
 * useActiveTocState hook and NavHeading type. No external dependencies.
 *
 * Active indicator: a thin accent bar clipped via CSS clip-path to the
 * vertical range of the currently active heading. Uses locally-scoped
 * --toc-top / --toc-height CSS custom properties (set via JS on resize
 * and active-state changes).
 */

import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useActiveTocState } from '../hooks/use-active-toc.ts'
import { useHolocronData } from '../router.ts'

/** Simple className joiner — filters falsy values and joins. */
function cn(...args: (string | false | null | undefined)[]): string {
  return args.filter(Boolean).join(' ')
}
import type { NavHeading } from '../navigation.ts'

export type { NavHeading }

/* ── Depth-based indentation ─────────────────────────────────────────── */

function getItemPadding(depth: number): string {
  if (depth <= 2) return '12px'
  if (depth === 3) return '24px'
  return '36px'
}

/* ── Indicator thumb ─────────────────────────────────────────────────── */

interface ThumbInfo {
  top: number
  height: number
}

function useThumb({
  containerRef,
  activeId,
}: {
  containerRef: React.RefObject<HTMLElement | null>
  activeId: string
}) {
  const thumbRef = useRef<HTMLDivElement>(null)

  const update = useCallback((info: ThumbInfo) => {
    const el = thumbRef.current
    if (!el) return
    el.style.setProperty('--toc-top', `${info.top}px`)
    el.style.setProperty('--toc-height', `${info.height}px`)
  }, [])

  const calc = useCallback((): ThumbInfo | null => {
    const container = containerRef.current
    if (!container || container.clientHeight === 0) return null
    if (!activeId) return { top: 0, height: 0 }

    const element = container.querySelector<HTMLElement>(`a[href="#${activeId}"]`)
    if (!element) return { top: 0, height: 0 }

    const styles = getComputedStyle(element)
    const top = element.offsetTop + parseFloat(styles.paddingTop)
    const bottom = element.offsetTop + element.clientHeight - parseFloat(styles.paddingBottom)

    return { top, height: bottom - top }
  }, [containerRef, activeId])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const recalc = () => {
      const info = calc()
      if (info) update(info)
    }

    recalc()

    const observer = new ResizeObserver(recalc)
    observer.observe(container)
    return () => observer.disconnect()
  }, [containerRef, calc, update])

  // Also recalc when activeId changes (without waiting for resize)
  useEffect(() => {
    const info = calc()
    if (info) update(info)
  }, [activeId, calc, update])

  return thumbRef
}

/* ── Main component ──────────────────────────────────────────────────── */

export function TableOfContentsPanel({
  headings: propHeadings,
  title = 'On this page',
  className,
}: {
  /** Optional — falls back to the active page's headings from loader data. */
  headings?: NavHeading[]
  title?: string
  className?: string
}) {
  const { currentHeadings } = useHolocronData()
  const headings = propHeadings ?? currentHeadings
  const headingIds = useMemo(() => headings.map((heading) => heading.slug), [headings])
  const fallbackId = headingIds[0] ?? ''
  const { activeId } = useActiveTocState({ fallbackId, headingIds })
  const containerRef = useRef<HTMLDivElement>(null)

  const thumbRef = useThumb({ containerRef, activeId })

  if (headings.length === 0) {
    return null
  }

  return (
    <nav
      aria-label={title}
      className={cn('relative text-[length:var(--type-small-size,13px)]', className)}
    >
      <p
        className='mb-2 text-[length:var(--type-small-size,13px)] font-semibold'
        style={{ color: 'var(--foreground)' }}
      >
        {title}
      </p>

      <div className='relative'>
        {/* Active indicator bar */}
        <div
          ref={thumbRef}
          data-hidden={!activeId}
          className='absolute inset-y-0 start-0 w-px transition-[clip-path] data-[hidden=true]:hidden'
          style={{
            backgroundColor: 'var(--primary)',
            clipPath:
              'polygon(0 var(--toc-top), 100% var(--toc-top), 100% calc(var(--toc-top) + var(--toc-height)), 0 calc(var(--toc-top) + var(--toc-height)))',
          }}
        />

        {/* Guide line */}
        <div
          ref={containerRef}
          className='flex flex-col border-s'
          style={{ borderColor: 'var(--border-subtle, rgba(0,0,0,0.08))' }}
        >
          {headings.map((heading) => {
            const isActive = heading.slug === activeId
            return (
              <a
                key={heading.slug}
                href={`#${heading.slug}`}
                data-active={isActive}
                className={cn(
                  'py-1.5 leading-snug transition-colors no-underline',
                  'hover:text-foreground',
                )}
                style={{
                  paddingInlineStart: getItemPadding(heading.depth),
                  color: isActive
                    ? 'var(--primary)'
                    : 'var(--muted-foreground)',
                }}
              >
                {heading.text}
              </a>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
