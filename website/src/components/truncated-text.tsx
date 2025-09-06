'use client'
import { useState } from 'react'
import { cn } from '../lib/cn'

interface TruncatedTextProps {
  children: React.ReactNode
  className?: string
  isStreaming?: boolean
}

export function TruncatedText({
  children,
  className,
  isStreaming = false,
}: TruncatedTextProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'cursor-pointer',
          !isExpanded && !isStreaming && 'line-clamp-3',
        )}
        onClick={() => {
          if (!isStreaming) {
            setIsExpanded(!isExpanded)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}
