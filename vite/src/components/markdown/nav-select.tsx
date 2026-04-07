'use client'

/**
 * Native <select> for version/dropdown switchers in the header bar.
 * Icon shown only for active item. External hrefs open in new tab.
 */

import React, { useCallback } from 'react'
import { router } from 'spiceflow/react'
import { Icon } from '../icon.tsx'
import type { ConfigIcon } from '../../config.ts'

export type NavSelectItem = {
  label: string
  href: string
  icon?: ConfigIcon
  tag?: string
  external?: boolean
}

type NavSelectProps = {
  items: NavSelectItem[]
  activeHref: string | undefined
  className?: string
  ariaLabel: string
}

export function NavSelect({ items, activeHref, className, ariaLabel }: NavSelectProps) {
  const activeItem = items.find((i) => i.href === activeHref) ?? items[0]

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const href = e.target.value
      const item = items.find((i) => i.href === href)
      if (!item) return

      if (item.external) {
        window.open(href, '_blank', 'noopener,noreferrer')
        e.target.value = activeItem?.href ?? ''
        return
      }

      router.push(href)
    },
    [items, activeItem],
  )

  if (items.length === 0) return null

  const formatLabel = (item: NavSelectItem) => {
    if (item.tag) return `${item.label} (${item.tag})`
    return item.label
  }
  const activeLabel = activeItem ? formatLabel(activeItem) : ''

  return (
    <div
      className={`relative inline-flex items-center gap-1.5 rounded-md border border-(--border-subtle) px-2 py-1 text-(color:--text-secondary) transition-colors duration-150 hover:border-(--text-secondary) hover:text-(color:--text-primary) ${className ?? ''}`}
    >
      <select
        aria-label={ariaLabel}
        value={activeItem?.href ?? ''}
        onChange={onChange}
        className='absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-md border-none opacity-0 outline-none'
        style={{
          fontFamily: 'var(--font-primary)',
        }}
      >
        {items.map((item) => (
          <option key={item.href} value={item.href}>
            {formatLabel(item)}
          </option>
        ))}
      </select>
      {activeItem?.icon && (
        <Icon icon={activeItem.icon} size={14} />
      )}
      <span className='text-xs text-current'>{activeLabel}</span>
      {/* Inline SVG — data-URI SVGs can't inherit currentColor */}
      <svg
        aria-hidden='true'
        viewBox='0 0 24 24'
        width={10}
        height={10}
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        className='-ml-1'
        style={{ flexShrink: 0 }}
      >
        <path d='m6 9 6 6 6-6' />
      </svg>
    </div>
  )
}
