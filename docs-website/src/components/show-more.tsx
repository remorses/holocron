'use client'

import { cn } from 'docs-website/src/lib/cn'
import { ChevronDownIcon } from 'lucide-react'
import React from 'react'

export function ShowMore({
    children,
    height = 160,
    background = 'black',
    className,
}: {
    children: React.ReactNode
    height?: number
    background?: string
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
            style={
                {
                    '--gradientBg': background,
                } as React.CSSProperties
            }
        >
            <div
                ref={contentRef}
                className={cn(
                    'overflow-hidden transition-all duration-300',
                    !isExpanded && needsExpansion && 'relative cursor-pointer',
                )}
                style={{
                    maxHeight:
                        isExpanded || !needsExpansion ? 'none' : `${height}px`,
                }}
                onClick={() => {
                    if (!isExpanded && needsExpansion) {
                        setIsExpanded(true)
                    }
                }}
            >
                <div
                    className={cn(
                        !isExpanded && needsExpansion && 'pointer-events-none',
                    )}
                >
                    {children}
                </div>
                {!isExpanded && needsExpansion && (
                    <div className='absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-(--gradientBg) to-(--gradientBg)/0 pointer-events-none' />
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
                        <ChevronDownIcon
                            className={cn(
                                'size-4 transition-transform',
                                isExpanded && 'rotate-180',
                            )}
                        />
                    </button>
                </div>
            )}
        </div>
    )
}
