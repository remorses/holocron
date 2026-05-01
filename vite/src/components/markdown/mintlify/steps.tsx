'use client'

/** Mintlify-compatible Steps and Step components. */

import React from 'react'
import { Icon } from '../../icon.tsx'

export function Steps({ children, titleSize = 'p' }: { children: React.ReactNode; titleSize?: 'p' | 'h2' | 'h3' | 'h4' }) {
  return <ol className='no-bleed m-0 flex list-none flex-col gap-(--prose-gap) ps-0 [counter-reset:step]'>{children}</ol>
}

export function Step({
  title,
  icon,
  iconType,
  children,
}: {
  title: string
  icon?: string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  children: React.ReactNode
}) {
  return (
    <li className='relative flex gap-3 [counter-increment:step]'>
      <div className='relative flex flex-col items-center'>
        <div className='flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-xs font-semibold text-foreground [&::before]:content-[counter(step)]' />
        <div className='mt-1.5 w-px flex-1 bg-border [li:last-child_&]:hidden' />
      </div>
      <div className='flex min-w-0 flex-1 flex-col gap-(--prose-gap) pb-2'>
        <div className='flex items-center gap-2 pt-1 text-sm font-semibold text-foreground'>
          {icon && <Icon icon={icon} iconType={iconType} size={16} />}
          {title}
        </div>
        <div className='no-bleed flex flex-col gap-(--prose-gap) text-sm text-muted-foreground'>{children}</div>
      </div>
    </li>
  )
}
