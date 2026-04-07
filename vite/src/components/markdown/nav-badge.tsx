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
        background: isDeprecated ? 'var(--sidebar-foreground-active)' : 'var(--selection-bg)',
        color: isDeprecated ? 'var(--background)' : 'var(--sidebar-section-foreground)',
      }}
    >
      {label}
    </span>
  )
}
