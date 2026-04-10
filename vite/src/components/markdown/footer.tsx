'use client'

/**
 * Site footer — logo + social icons + link columns.
 * Matches the Mintlify footer layout: top row (logo + socials),
 * bottom row (up to 4 link columns with headers).
 */

import React from 'react'
import { getDefaultTypeIcon } from '../../lib/collect-icons.ts'
import { useHolocronData } from '../../router.ts'
import { getResolvedLogo } from '../../site-data.ts'
import { Icon } from '../icon.tsx'

export function Footer() {
  const { site } = useHolocronData()
  const siteConfig = site.config
  const siteLogo = getResolvedLogo(site)
  const { socials, links } = siteConfig.footer
  const hasSocials = Object.keys(socials).length > 0
  const hasLinks = links.length > 0
  if (!hasSocials && !hasLinks) return null

  const logo = siteLogo
  const logoLinkHref = logo.href || '/'

  return (
    <footer className='border-t border-(--page-border) bg-background'>
      <div className='mx-auto w-full max-w-full px-(--mobile-padding) py-10 lg:max-w-(--grid-max-width) lg:px-0'>
        {/* Top row: logo + social icons */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <a href={logoLinkHref} className='no-underline flex items-center'>
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
                  <Icon icon={getDefaultTypeIcon(platform, site.config.icons.library) || 'link'} size={16} />
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

export function PoweredBy() {
  return (
    <div className='flex items-center justify-center py-6'>
      <a
        href='https://holocron.so?utm_source=powered-by'
        target='_blank'
        rel='noopener noreferrer'
        className='no-underline flex items-baseline gap-1 text-xs opacity-40 hover:opacity-70 transition-opacity duration-150'
      >
        <span>Powered by</span>
        <span className='font-bold'>Holocron</span>
      </a>
    </div>
  )
}
