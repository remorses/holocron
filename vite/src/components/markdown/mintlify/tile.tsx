'use client'

/** Mintlify-compatible Tile link component. */

import React from 'react'
import { Link } from 'spiceflow/react'

export function Tile({
  href,
  title,
  description,
  children,
}: {
  href: string
  title?: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Link href={href} className='no-underline'>
      <div className='flex h-full flex-col gap-3 rounded-lg border border-border-subtle bg-card p-3'>
        <div className='overflow-hidden rounded-lg border border-border-subtle bg-muted/40 p-2'>{children}</div>
        {title && <div className='text-sm font-semibold text-foreground'>{title}</div>}
        {description && <div className='text-xs text-muted-foreground'>{description}</div>}
      </div>
    </Link>
  )
}
