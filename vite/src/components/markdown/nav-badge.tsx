'use client'

import React from 'react'

export function NavBadge({ label, variant = 'default' }: { label: string; variant?: 'default' | 'deprecated' }) {
  const isDeprecated = variant === 'deprecated'
  return (
    <span
      className='inline-flex items-center rounded-full shrink-0'
      style={{
        padding: '0 6px',
        minHeight: '18px',
        fontSize: '10px',
        lineHeight: '18px',
        fontVariationSettings: '"wght" 600',
        letterSpacing: '0.01em',
        background: isDeprecated ? 'var(--sidebar-primary)' : 'var(--accent)',
        color: isDeprecated ? 'var(--background)' : 'var(--muted-foreground)',
      }}
    >
      {label}
    </span>
  )
}
