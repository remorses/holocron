'use client'

/** Mintlify-compatible Tile link component. */

import React from 'react'
import { Link } from '../link.tsx'

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
    <div className='group relative isolate h-full'>
      <Link href={href} aria-label={title ?? description ?? href} className='absolute inset-0 z-0 rounded-lg no-underline' />
      <div className='pointer-events-none relative z-10 flex h-full flex-col gap-3 rounded-lg border border-border-subtle bg-card p-3 [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_[role=button]]:pointer-events-auto'>
        <div className='overflow-hidden rounded-lg border border-border-subtle bg-muted/40 p-2'>{children}</div>
        {title && <div className='text-sm font-semibold text-foreground'>{title}</div>}
        {description && <div className='text-xs text-muted-foreground'>{description}</div>}
      </div>
    </div>
  )
}
