'use client'

/** Shared helpers for Mintlify-compatible MDX components. */

import React from 'react'
import { cn } from '../../lib/css-vars.ts'
import { Icon } from '../icon.tsx'

/** True when href has an explicit http(s) or protocol-relative prefix. */
function isAbsoluteHttpHref(href: string | undefined): boolean {
  return !!href && /^(https?:)?\/\//.test(href)
}

/** A link is external if it has an explicit protocol AND points to a
 *  different origin than the current site. Same-origin absolute URLs
 *  (e.g. `https://docs.mysite.com/guides`) get client-side navigation.
 *  Uses URL parsing so `https://foo.com.evil.com` is correctly treated
 *  as external even when origin is `https://foo.com`. */
export function isExternalHref(href: string | undefined, origin?: string): boolean {
  if (!isAbsoluteHttpHref(href)) return false
  if (!origin) return true
  try {
    return new URL(href!, origin).origin !== origin
  } catch {
    return true
  }
}

/** Strip the origin from a same-origin absolute URL so spiceflow Link
 *  can handle it as a relative path for client-side navigation.
 *  External and relative URLs are returned unchanged. Preserves
 *  search params and hash. */
export function stripOriginIfSameHost(href: string, origin: string | undefined): string {
  if (!origin || !isAbsoluteHttpHref(href)) return href
  try {
    const url = new URL(href, origin)
    if (url.origin !== origin) return href
    return `${url.pathname}${url.search}${url.hash}` || '/'
  } catch {
    return href
  }
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
