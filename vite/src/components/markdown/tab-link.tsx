'use client'

/**
 * TabLink — single tab rendered in the tab bar. Active tab gets a 1.5px
 * bottom indicator + faux bold via text-shadow. Used by EditorialPage.
 */

import React from 'react'
import { Link } from 'spiceflow/react'
import type { TabItem } from '../../site-data.ts'
import { Icon } from '../icon.tsx'

export function TabLink({ tab, isActive }: { tab: TabItem; isActive: boolean }) {
  const isExternal = tab.href.startsWith('http')
  const tabClassName = 'slot-tab no-underline inline-flex items-center gap-1.5 text-(length:--type-toc-size) font-[475] [font-family:var(--font-primary)] lowercase transition-colors duration-150'
  const tabStyle = {
    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
    textShadow: isActive ? '-0.2px 0 0 currentColor, 0.2px 0 0 currentColor' : 'none',
  }
  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isActive) {
      e.currentTarget.style.color = 'var(--text-primary)'
      const indicator = e.currentTarget.querySelector<HTMLElement>('[data-tab-indicator]')
      if (indicator) {
        indicator.style.backgroundColor = 'var(--text-tertiary)'
      }
    }
  }
  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isActive) {
      e.currentTarget.style.color = 'var(--text-secondary)'
      const indicator = e.currentTarget.querySelector<HTMLElement>('[data-tab-indicator]')
      if (indicator) {
        indicator.style.backgroundColor = 'transparent'
      }
    }
  }
  const indicator = (
    <div
      data-tab-indicator
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '100%',
        height: '1.5px',
        backgroundColor: isActive ? 'var(--text-primary)' : 'transparent',
        borderRadius: '1px',
        transition: 'background-color 0.15s ease',
      }}
    />
  )

  if (isExternal) {
    return (
      <a
        href={tab.href}
        target='_blank'
        rel='noopener noreferrer'
        className={tabClassName}
        style={tabStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Icon icon={tab.icon} size={14} />
        {tab.label}
        {indicator}
      </a>
    )
  }

  return (
    <Link
      href={tab.href}
      className={tabClassName}
      style={tabStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Icon icon={tab.icon} size={14} />
      {tab.label}
      {indicator}
    </Link>
  )
}
