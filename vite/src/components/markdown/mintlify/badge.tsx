'use client'

/** Mintlify-compatible Badge component using Holocron color tokens. */

import React from 'react'
import { Icon } from '../../icon.tsx'
import { isExternalHref, renderCompatIcon } from './shared.tsx'

export function Badge({
  children,
  color = 'gray',
  icon,
  leadIcon,
  tailIcon,
  iconType,
  iconLibrary: _iconLibrary,
  size,
  shape = 'rounded',
  stroke,
  variant,
  disabled,
  href,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  color?: string
  icon?: React.ReactNode | string
  leadIcon?: React.ReactNode | string
  tailIcon?: React.ReactNode | string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  iconLibrary?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  shape?: 'rounded' | 'pill'
  variant?: 'solid' | 'outline'
  stroke?: boolean
  disabled?: boolean
  href?: string
  onClick?: () => void
  className?: string
}) {
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]'
    : size === 'sm' ? 'px-2 py-0.5 text-[11px]'
    : size === 'lg' ? 'px-3 py-1 text-[13px]'
    : 'px-2 py-0.5 text-[11px]'
  const shapeClass = shape === 'pill' ? 'rounded-full' : 'rounded-md'
  const outline = variant === 'outline' || stroke
  const iconSize = size === 'xs' ? 10 : size === 'lg' ? 14 : 12
  const leading = renderCompatIcon({ icon: leadIcon, iconType, size: iconSize })
  const trailing = renderCompatIcon({ icon: tailIcon ?? icon, iconType, size: iconSize })

  const renderBadge = (variantClass: string, iconColor?: string) => {
    const badgeClass = `inline-flex w-fit self-start items-center gap-1 border ${sizeClass} ${shapeClass} ${variantClass} ${disabled ? 'opacity-50' : ''} ${(href || onClick) && !disabled ? 'cursor-pointer transition-opacity hover:opacity-80' : ''} ${className}`.trim()
    const content = <>{leading}{children}{trailing || (iconColor && icon ? <Icon icon={String(icon)} iconType={iconType} size={iconSize} color={iconColor} /> : null)}</>
    if (href && !disabled) {
      const external = isExternalHref(href)
      return <a className={badgeClass} href={href} onClick={onClick} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{content}</a>
    }
    if (onClick && !disabled) {
      return <button type='button' className={badgeClass} onClick={onClick}>{content}</button>
    }
    return <span className={badgeClass}>{content}</span>
  }

  if (color === 'gray' || color === 'surface') {
    return renderBadge('bg-muted text-foreground border-border-subtle')
  }
  if (color === 'white') {
    return renderBadge('bg-white/85 text-neutral-900 dark:text-neutral-100 border-black/8')
  }
  const destructive = color === 'white-destructive' || color === 'surface-destructive'
  if (destructive) {
    return renderBadge('bg-red/10 text-red border-red/20', 'var(--red)')
  }
  const cls: Record<string, string> = {
    blue: outline ? 'text-blue border-blue' : 'bg-blue/10 text-blue border-blue/20',
    green: outline ? 'text-green border-green' : 'bg-green/10 text-green border-green/20',
    yellow: outline ? 'text-yellow border-yellow' : 'bg-yellow/10 text-yellow border-yellow/20',
    orange: outline ? 'text-orange border-orange' : 'bg-orange/10 text-orange border-orange/20',
    red: outline ? 'text-red border-red' : 'bg-red/10 text-red border-red/20',
    purple: outline ? 'text-purple border-purple' : 'bg-purple/10 text-purple border-purple/20',
  }
  const variantCls = cls[color] ?? cls.blue!
  return renderBadge(variantCls)
}
