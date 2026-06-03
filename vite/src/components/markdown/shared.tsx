'use client'

/** Shared helpers for Mintlify-compatible MDX components. */

import React from 'react'
import { cn } from '../../lib/css-vars.ts'
import { Icon } from '../icon.tsx'

/** A link is external if it has an explicit protocol AND points to a
 *  different origin than the current site. Same-origin absolute URLs
 *  (e.g. `https://docs.mysite.com/guides`) get client-side navigation. */
export function isExternalHref(href: string | undefined, origin?: string) {
  if (!href) return false
  if (!href.startsWith('http://') && !href.startsWith('https://')) return false
  // If we know the current origin, same-origin URLs are internal
  if (origin && href.startsWith(origin)) return false
  return true
}

/** Strip the origin from a same-origin absolute URL so spiceflow Link
 *  can handle it as a relative path for client-side navigation.
 *  External and relative URLs are returned unchanged. */
export function stripOriginIfSameHost(href: string, origin: string): string {
  if (origin && href.startsWith(origin)) {
    return href.slice(origin.length) || '/'
  }
  return href
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
