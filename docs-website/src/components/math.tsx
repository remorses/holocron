'use client'
import clsx from 'clsx'

import React, { lazy, Suspense } from 'react'

const Katex = lazy(() => import('@matejmazur/react-katex'))

export const Latex: React.FC<{
    math: string

    displayBlock?: boolean
    children?: React.ReactNode
    inline?: boolean
    className?: string
}> = ({ math, className, displayBlock, inline, ...rest }) => {
    if (!math) return null

    return (
        <span
            role='button'
            tabIndex={0}
            className={clsx(
                'relative rounded transition-colors',
                inline
                    ? 'inline-flex select-all'
                    : 'flex flex-col overflow-auto w-full py-1 px-2 my-1 cursor-pointer max-w-full',
                className,
            )}
        >
            <Katex
                math={math}
                settings={{
                    throwOnError: false,
                    strict: false,
                    displayMode: displayBlock,
                }}
                {...rest}
            />
        </span>
    )
}
