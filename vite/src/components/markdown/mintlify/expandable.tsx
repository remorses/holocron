'use client'

/** Mintlify-compatible Expandable disclosure component. */

import React from 'react'
import { cn } from '../../../lib/css-vars.ts'
import { Chevron } from './chevron.tsx'
import { renderCompatIcon } from './shared.tsx'

export function Expandable({
  title = 'Expandable',
  description,
  icon,
  iconType,
  iconLibrary: _iconLibrary,
  defaultOpen = false,
  className = '',
  children,
}: {
  title?: React.ReactNode
  description?: string
  icon?: React.ReactNode | string
  iconType?: string
  iconLibrary?: string
  defaultOpen?: boolean | string
  className?: string
  children: React.ReactNode
}) {
  const open = defaultOpen === true || defaultOpen === 'true'
  return (
    <details className={cn('no-bleed group rounded-lg border border-border-subtle bg-card', className)} open={open}>
      <summary className='flex cursor-pointer select-none list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden'>
        {renderCompatIcon({ icon, iconType, size: 16 })}
        <span className='flex min-w-0 flex-col gap-1'>
          <span className='font-semibold text-foreground'>{title}</span>
          {description && <span className='text-xs font-normal text-muted-foreground'>{description}</span>}
        </span>
        <Chevron />
      </summary>
      <div className='no-bleed flex flex-col gap-3 px-4 pb-4 text-sm text-muted-foreground'>{children}</div>
    </details>
  )
}
