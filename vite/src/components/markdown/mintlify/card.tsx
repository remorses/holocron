'use client'

/** Mintlify-compatible card and column grid components. */

import React from 'react'
import { Link } from 'spiceflow/react'
import { cn } from '../../../lib/css-vars.ts'
import { isExternalHref, renderCompatIcon } from './shared.tsx'

function resolveColumns(cols: number | undefined) {
  const value = Math.min(Math.max(cols ?? 2, 1), 4)
  return `repeat(${value}, minmax(0, 1fr))`
}

export function Card({
  title,
  icon,
  iconType,
  iconLibrary: _iconLibrary,
  color,
  href,
  horizontal,
  img,
  cta,
  arrow,
  disabled,
  as,
  className = '',
  children,
}: {
  title?: React.ReactNode
  icon?: React.ReactNode | string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  iconLibrary?: string
  color?: string
  href?: string
  horizontal?: boolean
  img?: string
  cta?: string
  arrow?: boolean
  disabled?: boolean
  as?: React.ElementType
  className?: string
  children?: React.ReactNode
}) {
  const external = isExternalHref(href)
  const showArrow = arrow ?? external
  const content = (
    <div className={cn('group/card relative flex h-full flex-col gap-2 rounded-lg border border-border-subtle bg-card p-4', horizontal && 'flex-row items-center', disabled && 'opacity-50', className)}>
      {img && <img src={img} alt='' className='w-full rounded-lg border border-border-subtle' style={{ maxWidth: '100%', height: 'auto' }} />}
      <div className='flex items-center gap-2'>
        {renderCompatIcon({ icon, iconType, size: 16, color })}
        {title ? <div className='text-sm font-semibold text-foreground'>{title}</div> : null}
      </div>
      {children !== undefined && children !== null && <div className='flex flex-col gap-3 text-sm text-muted-foreground'>{children}</div>}
      {(cta || showArrow) && <div className='flex items-center gap-1 text-xs text-primary'>{cta}{showArrow && <span aria-hidden='true'>↗</span>}</div>}
    </div>
  )
  if (disabled || !href) {
    if (!as) return content
    const Component = as
    return <Component>{content}</Component>
  }
  if (external) return <a href={href} target='_blank' rel='noreferrer' className='no-underline'>{content}</a>
  return <Link href={href} className='no-underline'>{content}</Link>
}

export function Columns({ cols, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div className='grid gap-4' style={{ gridTemplateColumns: resolveColumns(cols) }}>
      {children}
    </div>
  )
}

export function CardGroup({ cols, children }: { cols?: number; children: React.ReactNode }) {
  // Mintlify authors use <CardGroup> as the card-grid primitive; keep it as
  // an explicit alias so MDX doesn't silently drop those sections.
  return <Columns cols={cols}>{children}</Columns>
}

export function Column({ children }: { children: React.ReactNode }) {
  return <div className='flex min-w-0 flex-col gap-3'>{children}</div>
}
