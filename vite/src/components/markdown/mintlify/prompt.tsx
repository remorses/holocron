'use client'

/** Mintlify-compatible Prompt component with optional copy action. */

import React from 'react'
import { Icon } from '../../icon.tsx'
import { SectionCard } from './shared.tsx'

export function Prompt({
  description,
  icon,
  iconType,
  actions,
  children,
}: {
  description: string
  icon?: string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  actions?: string[]
  children: React.ReactNode
}) {
  const plainText = typeof children === 'string' || typeof children === 'number'
  const showCopy = !actions || actions.includes('copy')
  return (
    <SectionCard>
      <div className='flex flex-col gap-3'>
        <div className='flex items-center gap-2'>
          {icon && <Icon icon={icon} iconType={iconType} size={16} />}
          <div className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{description}</div>
        </div>
        <div
          className={plainText
            ? 'rounded-lg bg-muted/50 p-3 text-sm text-foreground [font-family:var(--font-code)] whitespace-pre-wrap'
            : 'flex flex-col gap-3 rounded-lg bg-muted/30 p-3 text-sm text-foreground'}
        >
          {children}
        </div>
        {showCopy && (
          <button
            type='button'
            className='self-end rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors'
            onClick={() => { void navigator.clipboard.writeText(String(children)) }}
          >
            Copy
          </button>
        )}
      </div>
    </SectionCard>
  )
}
