'use client'

/** Shared helpers for Mintlify-compatible MDX components. */

import React from 'react'
import { cn } from '../../../lib/css-vars.ts'
import { Icon } from '../../icon.tsx'

export function isExternalHref(href: string | undefined) {
  return href?.startsWith('http://') || href?.startsWith('https://')
}

export function renderCompatIcon({
  icon,
  iconType,
  size = 16,
  color,
}: {
  icon: React.ReactNode | string | undefined
  iconType?: string
  size?: number
  color?: string
}) {
  if (!icon) return null
  if (typeof icon === 'string') return <Icon icon={icon} iconType={iconType} size={size} color={color} />
  return icon
}

export function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('no-bleed flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4', className)}>
      {children}
    </div>
  )
}
