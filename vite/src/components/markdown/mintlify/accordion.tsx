'use client'

import React from 'react'

function Chevron() {
  return (
    <span className='ml-auto flex shrink-0 items-center text-(color:--text-secondary)'>
      <svg className='block h-4 w-4 group-open:hidden' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
        <path d='M6 4.5 9.5 8 6 11.5' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
      <svg className='hidden h-4 w-4 group-open:block' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
        <path d='M4.5 6 8 9.5 11.5 6' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </span>
  )
}

export function AccordionGroup({ children }: { children: React.ReactNode }) {
  return <div className='flex flex-col gap-3'>{children}</div>
}

export function Accordion({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details className='no-bleed group rounded-(--border-radius-md) border border-(--border-subtle) bg-card' open={defaultOpen}>
      <summary className='flex cursor-pointer list-none items-center gap-4 px-4 py-3 text-left [&::-webkit-details-marker]:hidden'>
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
