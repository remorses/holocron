'use client'

import { ChevronDownIcon } from 'lucide-react'
import React from 'react'

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}

/**
 * Collapses content with a gradient fade. Requires parent to set `--show-more-bg` CSS variable to a tailwind color.
 * 
 * @example
 * ```tsx
 * <div style={{ '--show-more-bg': 'hsl(var(--background))' } as CSSProperties}>
 *   <ShowMore height={200}>Long content...</ShowMore>
 * </div>
 * ```
 */
export function ShowMore({
  children,
  height = 160,
  className,
}: {
  children: React.ReactNode
  height?: number
  className?: string
}) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [needsExpansion, setNeedsExpansion] = React.useState(false)

  React.useEffect(() => {
    if (contentRef.current) {
      setNeedsExpansion(contentRef.current.scrollHeight > height)
    }
  }, [height, children])

  return (
    <div
      className={cn('relative', className)}
      // style={
      //     {
      //         '--show-more-bg':
      //             'var(--show-more-bg, var(--color-background))',
      //     } as React.CSSProperties
      // }
    >
      <div
        ref={contentRef}
        className={cn(
          'overflow-hidden transition-all duration-300',
          !isExpanded && needsExpansion && 'relative cursor-pointer',
        )}
        style={{
          maxHeight: isExpanded || !needsExpansion ? 'none' : `${height}px`,
        }}
        onClick={() => {
          if (!isExpanded && needsExpansion) {
            setIsExpanded(true)
          }
        }}
      >
        <div className={cn(!isExpanded && needsExpansion && 'pointer-events-none')}>{children}</div>
        {!isExpanded && needsExpansion && (
          <div className='absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-(--show-more-bg) to-transparent pointer-events-none' />
        )}
      </div>
      {needsExpansion && (
        <div className='flex justify-center mt-2'>
          <button
            onClick={() => {
              setIsExpanded(!isExpanded)
            }}
            className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
          >
            <span>{isExpanded ? 'Show less' : 'Show more'}</span>
            <ChevronDownIcon className={cn('size-4 transition-transform', isExpanded && 'rotate-180')} />
          </button>
        </div>
      )}
    </div>
  )
}
