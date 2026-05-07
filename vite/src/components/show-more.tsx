'use client'

/**
 * ShowMore — collapsible wrapper with gradient fade.
 *
 * Measures content height and collapses to a configurable max-height
 * with a fade-to-background gradient overlay. Click to expand/collapse.
 * Used in chat tool output previews and anywhere long content needs
 * progressive disclosure.
 */

import React, { useState, useEffect, useRef } from 'react'
import { ChevronDownIcon } from './chat-icons.tsx'

export function ShowMore({
  children,
  height = 80,
}: {
  children: React.ReactNode
  height?: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [needsExpansion, setNeedsExpansion] = useState(false)

  useEffect(() => {
    if (contentRef.current) {
      setNeedsExpansion(contentRef.current.scrollHeight > height)
    }
  }, [height, children])

  return (
    <div className='flex flex-col gap-1'>
      <div
        ref={contentRef}
        style={{
          overflow: 'hidden',
          transition: 'max-height 300ms ease',
          maxHeight:
            isExpanded || !needsExpansion ? 'none' : `${height}px`,
          position: 'relative',
          cursor: !isExpanded && needsExpansion ? 'pointer' : undefined,
        }}
        onClick={() => {
          if (!isExpanded && needsExpansion) setIsExpanded(true)
        }}
      >
        {children}
        {!isExpanded && needsExpansion && (
          <div
            style={{
              position: 'absolute',
              insetInline: 0,
              bottom: 0,
              height: '64px',
              background:
                'linear-gradient(to top, var(--background), transparent)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      {needsExpansion && (
        <div className='flex justify-center'>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: 'var(--foreground)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px',
            }}
          >
            <span>{isExpanded ? 'Show less' : 'Show more'}</span>
            <ChevronDownIcon
              size={14}
              className={isExpanded ? 'rotate-180' : ''}
            />
          </button>
        </div>
      )}
    </div>
  )
}
