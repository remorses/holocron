'use client'

import React from 'react'
import { Icon } from '../../icon.tsx'
import { Chevron } from './chevron.tsx'

export function AccordionGroup({ children }: { children: React.ReactNode }) {
  return <div className='flex flex-col gap-3'>{children}</div>
}

export function Accordion({
  title,
  description,
  defaultOpen = false,
  icon,
  iconType,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  icon?: string
  /** TODO: FA/tabler iconType values render null until atlas includes those packs. */
  iconType?: string
  children: React.ReactNode
}) {
  return (
    <details className='no-bleed group rounded-(--border-radius-md) border border-(--border-subtle) bg-card' open={defaultOpen}>
      <summary className='flex cursor-pointer list-none items-center gap-4 px-4 py-3 text-left [&::-webkit-details-marker]:hidden'>
        {icon && <Icon icon={icon} iconType={iconType} size={16} />}
        <span className='flex min-w-0 flex-col gap-1'>
          <span className='text-sm font-semibold text-(color:--text-primary)'>{title}</span>
          {description && <span className='text-xs text-(color:--text-secondary)'>{description}</span>}
        </span>
        <Chevron />
      </summary>
      <div className='no-bleed flex flex-col gap-3 px-4 pb-4 pt-1'>{children}</div>
    </details>
  )
}