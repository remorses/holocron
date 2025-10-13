'use client'

import { ChevronDownIcon } from 'lucide-react'
import React from 'react'

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}

/**
 * ShowMore component that collapses content with a gradient fade effect
 * 
 * Displays content up to a specified height, showing a "Show more" button when content exceeds that height.
 * When collapsed, displays a gradient fade at the bottom that blends into the background.
 * 
 * @remarks
 * The gradient fade uses the CSS variable `--show-more-bg` to match the parent background color.
 * Parent components should set this CSS variable in their style prop:
 * 
 * @example
 * ```tsx
 * <div style={{ '--show-more-bg': 'var(--color-background)' } as CSSProperties}>
 *   <ShowMore height={200}>
 *     <div>Long content here...</div>
 *   </ShowMore>
 * </div>
 * ```
 * 
 * @param children - Content to be shown/hidden
 * @param height - Maximum height in pixels before content is collapsed (default: 160)
 * @param className - Additional CSS classes to apply to the container
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
