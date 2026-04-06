'use client'

/**
 * Site footer — logo + social icons + link columns.
 * Matches the Mintlify footer layout: top row (logo + socials),
 * bottom row (up to 4 link columns with headers).
 */

import React from 'react'
import { config as siteConfig } from '../../data.ts'
import { Icon } from '../icon.tsx'

/** Map social platform keys to lucide icon names. Aligned with the
 *  TYPE_ICONS map in normalize-config.ts and the socialPlatformKeys
 *  list in schema.ts. */
const SOCIAL_ICONS: Record<string, string> = {
  github: 'github',
  x: 'twitter',
  twitter: 'twitter',
  'x-twitter': 'twitter',
  linkedin: 'linkedin',
  discord: 'message-circle',
  slack: 'slack',
  youtube: 'youtube',
  facebook: 'facebook',
  instagram: 'instagram',
  website: 'globe',
  'earth-americas': 'globe',
  'hacker-news': 'newspaper',
  medium: 'book-open',
  telegram: 'send',
  bluesky: 'cloud',
  threads: 'at-sign',
  reddit: 'message-square',
  podcast: 'rss',
}

export function Footer() {
  const { socials, links } = siteConfig.footer
  const hasSocials = Object.keys(socials).length > 0
  const hasLinks = links.length > 0
  if (!hasSocials && !hasLinks) return null

  const logo = siteConfig.logo
  const logoLinkHref = logo.href || '/'

  return (
    <footer className='mt-auto border-t border-(--page-border) bg-background'>
      <div className='mx-auto w-full max-w-full px-(--mobile-padding) py-10 lg:max-w-(--grid-max-width) lg:px-0'>
        {/* Top row: logo + social icons */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <a href={logoLinkHref} className='no-underline flex items-center'>
            {logo.light ? (
              <>
                {logo.dark ? (
                  <>
                    <img src={logo.light} alt={siteConfig.name || 'Logo'} className='h-6 w-auto dark:hidden' />
                    <img src={logo.dark} alt={siteConfig.name || 'Logo'} className='h-6 w-auto hidden dark:block' />
                  </>
                ) : (
                  <img src={logo.light} alt={siteConfig.name || 'Logo'} className='h-6 w-auto dark:invert' />
                )}
              </>
            ) : (
              <span className='text-sm font-bold text-(color:--text-primary) [font-family:var(--font-code)] lowercase'>
                {siteConfig.name || 'docs'}
              </span>
            )}
          </a>
          {hasSocials && (
            <div className='flex items-center gap-3'>
              {Object.entries(socials).map(([platform, url]) => (
                <a
                  key={platform}
                  href={url as string}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label={platform}
                  className='no-underline text-(color:--text-secondary) transition-colors duration-150 hover:text-(color:--text-primary)'
                >
                  <Icon icon={SOCIAL_ICONS[platform] || 'link'} size={16} />
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Link columns */}
        {hasLinks && (
          <div className='mt-8 grid grid-cols-2 gap-8 sm:grid-cols-4'>
            {links.map((column, i) => (
              <div key={i} className='flex flex-col gap-2'>
                {column.header && (
                  <div className='text-xs font-semibold text-(color:--text-secondary) uppercase tracking-wider mb-1'>
                    {column.header}
                  </div>
                )}
                {column.items.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target={item.href.startsWith('http') ? '_blank' : undefined}
                    rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className='no-underline text-sm text-(color:--text-secondary) transition-colors duration-150 hover:text-(color:--text-primary)'
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </footer>
  )
}
