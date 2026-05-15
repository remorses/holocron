'use client'

/** Mintlify-compatible file tree components. */

import React from 'react'
import { cn } from '../../../lib/css-vars.ts'
import { Chevron } from './chevron.tsx'
import { renderCompatIcon, SectionCard } from './shared.tsx'

export function Tree({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <SectionCard><div className={cn('no-bleed flex flex-col gap-1 font-[var(--font-code)] text-sm', className)}>{children}</div></SectionCard>
}

export function TreeFolder({
  name,
  icon,
  iconType,
  defaultOpen = false,
  openable = true,
  className = '',
  children,
}: {
  name: string
  icon?: React.ReactNode | string
  iconType?: string
  defaultOpen?: boolean | string
  openable?: boolean
  className?: string
  children: React.ReactNode
}) {
  const open = defaultOpen === true || defaultOpen === 'true'
  if (!openable) {
    return (
      <div className={cn('ms-2 flex flex-col gap-1', className)}>
        <div className='flex items-center gap-2 text-foreground'>
          {renderCompatIcon({ icon, iconType, size: 14 }) ?? <span aria-hidden='true'>•</span>}
          <span>{name}/</span>
        </div>
        <div className='ms-4 flex flex-col gap-1'>{children}</div>
      </div>
    )
  }
  return (
    <details className={cn('group ms-2 flex flex-col gap-1', className)} open={open}>
      <summary className='flex cursor-pointer select-none list-none items-center gap-2 text-foreground [&::-webkit-details-marker]:hidden'>
        {renderCompatIcon({ icon, iconType, size: 14 })}
        <span>{name}/</span>
        <Chevron />
      </summary>
      <div>
        <div className='ms-4 flex flex-col gap-1'>{children}</div>
      </div>
    </details>
  )
}

export function TreeFile({ name, icon, iconType, className = '' }: { name: string; icon?: React.ReactNode | string; iconType?: string; className?: string }) {
  return <div className={cn('ms-2 flex items-center gap-2 text-muted-foreground', className)}>{renderCompatIcon({ icon, iconType, size: 14 })}<span>{name}</span></div>
}
