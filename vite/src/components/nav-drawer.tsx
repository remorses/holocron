'use client'

/**
 * NavDrawer — slide-from-left navigation drawer for mobile.
 * Contains: version/dropdown selects, header links, primary CTA,
 * theme toggle, and the SideNav (search + nav tree).
 * Portals to <body> for correct stacking.
 * Closes on backdrop click, close button, or page navigation.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { chatState } from '../lib/chat-state.ts'
import { CloseIcon } from './chat-icons.tsx'
import { SideNav } from './markdown/side-nav.tsx'
import { NavSelect, type NavSelectItem } from './markdown/nav-select.tsx'
import { Icon } from './icon.tsx'
import { ThemeToggle } from './theme-toggle.tsx'
import { useHolocronData } from '../router.ts'
import {
  config as siteConfig,
  headerLinks as siteHeaderLinks,
  versionItems as siteVersionItems,
  dropdownItems as siteDropdownItems,
  tabs as siteTabs,
} from '../data.ts'
import { TabLink } from './markdown/tab-link.tsx'

export function NavDrawer() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null

  return <NavDrawerInner />
}

function NavDrawerInner() {
  const isOpen = chatState((s) => s.navDrawerOpen)
  const { currentPageHref, activeVersionHref, activeDropdownHref, activeTabHref } =
    useHolocronData()

  const primary = siteConfig.navbar?.primary
  const versionItems = siteVersionItems
  const dropdownSelectItems = siteDropdownItems
  const headerLinks = siteHeaderLinks
  const tabs = siteTabs

  const handleClose = useCallback(() => {
    chatState.setState({ navDrawerOpen: false })
  }, [])

  // Close on page navigation
  useEffect(() => {
    if (isOpen) handleClose()
  }, [currentPageHref])

  // Disable body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
  useEffect(() => {
    setPortalTarget(document.body)
  }, [])

  if (!portalTarget || !isOpen) return null

  return createPortal(
    <div style={{ position: 'relative', zIndex: 200 }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        aria-hidden='true'
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgb(0 0 0 / 0.5)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Drawer panel — slides from left */}
      <div
        aria-hidden={!isOpen}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          width: '100vw',
          maxWidth: '360px',
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 200ms ease',
          background: 'var(--background)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Close button */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 16px',
            flexShrink: 0,
          }}
        >
          <button
            onClick={handleClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
            aria-label='Close menu'
          >
            <CloseIcon />
          </button>
        </div>

        {/* Top row: version/dropdown selects + theme toggle + header links */}
        <div
          style={{
            padding: '0 16px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Selects + theme toggle on one row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {versionItems.length > 0 && (
              <NavSelect
                items={versionItems}
                activeHref={activeVersionHref}
                ariaLabel='Select version'
              />
            )}
            {dropdownSelectItems.length > 0 && (
              <NavSelect
                items={dropdownSelectItems}
                activeHref={activeDropdownHref}
                ariaLabel='Select section'
              />
            )}
            <div style={{ marginLeft: 'auto' }}>
              {!siteConfig.appearance.strict && <ThemeToggle />}
            </div>
          </div>

          {/* Header links + primary CTA */}
          {((headerLinks.length > 0) || Boolean(primary?.href)) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {headerLinks?.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='no-underline flex items-center gap-2 text-(color:--text-secondary) transition-colors duration-150 hover:text-(color:--text-primary)'
                  style={{ fontSize: '13px' }}
                >
                  <Icon icon={link.icon} size={16} />
                  <span>{link.label}</span>
                </a>
              ))}
              {!!primary?.href && (
                <a
                  href={primary.href}
                  target={primary.href.startsWith('http') ? '_blank' : undefined}
                  rel={primary.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className='no-underline inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-(--border-subtle) text-(color:--text-secondary) transition-colors duration-150 hover:text-(color:--text-primary) hover:border-(--text-secondary)'
                >
                  <Icon icon={primary.icon} size={14} />
                  <span>{primary.label}</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Tabs — horizontal row, same as desktop tab bar */}
        {tabs.length > 0 && (
          <div className='slot-tabbar' style={{ marginBottom: '20px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: '24px',
                overflowX: 'auto',
                padding: '0 16px',
                height: 'var(--tab-bar-height)',
              }}
            >
              {tabs.map((tab) => (
                <TabLink
                  key={tab.href}
                  tab={tab}
                  isActive={tab.href === (activeTabHref ?? tabs[0]?.href)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Navigation tree — override SideNav's max-w to use full drawer width */}
        <div style={{ flex: 1, padding: '0 16px 16px' }} className='[&_aside]:max-w-full'>
          <SideNav />
        </div>
      </div>
    </div>,
    portalTarget,
  )
}
