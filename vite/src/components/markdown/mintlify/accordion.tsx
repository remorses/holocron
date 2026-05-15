'use client'

import React, { useEffect, useRef } from 'react'
import { cn } from '../../../lib/css-vars.ts'
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
  iconLibrary: _iconLibrary,
  className = '',
  _disabled,
  trackOpen,
  trackClose,
  onMount,
  children,
}: {
  title: React.ReactNode
  description?: string
  defaultOpen?: boolean | string
  icon?: React.ReactNode | string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  iconLibrary?: string
  className?: string
  _disabled?: boolean
  trackOpen?: (event: { title: string }) => void
  trackClose?: (event: { title: string }) => void
  onMount?: () => void
  children: React.ReactNode
}) {
  const open = defaultOpen === true || defaultOpen === 'true'
  const openRef = useRef(open)
  const titleText = typeof title === 'string' ? title : ''

  useEffect(() => {
    onMount?.()
  }, [onMount])

  return (
    <details
      className={cn('no-bleed group rounded-lg border border-border-subtle bg-card', _disabled && 'opacity-60', className)}
      open={open}
      onToggle={(event) => {
        const nextOpen = event.currentTarget.open
        if (_disabled) {
          event.currentTarget.open = openRef.current
          return
        }
        if (nextOpen === openRef.current) return
        openRef.current = nextOpen
        if (nextOpen) trackOpen?.({ title: titleText })
        else trackClose?.({ title: titleText })
      }}
    >
      <summary className='flex cursor-pointer select-none list-none items-center gap-4 px-4 py-3 text-left [&::-webkit-details-marker]:hidden'>
        {typeof icon === 'string' ? <Icon icon={icon} iconType={iconType} size={16} /> : icon}
        <span className='flex min-w-0 flex-col gap-1'>
          <span className='text-sm font-semibold text-foreground'>{title}</span>
          {description && <span className='text-xs text-muted-foreground'>{description}</span>}
        </span>
        <Chevron />
      </summary>
      <div className='no-bleed flex flex-col gap-3 px-4 pb-4 pt-1'>{children}</div>
    </details>
  )
}
