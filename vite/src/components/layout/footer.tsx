'use client'

/**
 * Site footer — logo + social icons + link columns.
 * Matches the Mintlify footer layout: top row (logo + socials),
 * bottom row (up to 4 link columns with headers).
 */

import React from 'react'
import { Link } from 'spiceflow/react'
import { getDefaultTypeIcon } from '../../lib/collect-icons.ts'
import { cn } from '../../lib/css-vars.ts'
import { getGeneratedLogoUrl } from '../../lib/generated-logo.tsx'
import { useHolocronData } from '../../router.ts'
import { getResolvedLogo } from '../../site-data.ts'
import { Icon } from '../icon.tsx'

export type LogoProps = Omit<React.ComponentProps<'img'>, 'src' | 'alt'> & {
  alt?: string
  /** When provided, always renders the AI-generated logo using this text. */
  text?: string
}

export function Logo({ className, alt, style, text, ...props }: LogoProps) {
  const { site } = useHolocronData()
  const siteConfig = site.config
  const logo = text
    ? { light: getGeneratedLogoUrl(text), dark: getGeneratedLogoUrl(text), generated: true as const }
    : getResolvedLogo(site)
  const label = (alt ?? text ?? siteConfig.name) || 'Logo'
  const baseStyle: React.CSSProperties = { width: 'auto', ...style }

  if (logo.generated) {
    return (
      <>
        <img
          {...props}
          src={logo.light}
          alt={label}
          className={cn('h-6 w-auto', className, 'dark:hidden')}
          style={{ ...baseStyle, mixBlendMode: 'multiply' }}
        />
        <img
          {...props}
          src={logo.light}
          alt={label}
          className={cn('h-6 w-auto', className, 'hidden dark:block')}
          style={{ ...baseStyle, mixBlendMode: 'screen', filter: 'invert(1)' }}
        />
      </>
    )
  }

  if (logo.dark) {
    return (
      <>
        <img {...props} src={logo.light} alt={label} className={cn('h-6 w-auto', className, 'dark:hidden')} style={baseStyle} />
        <img {...props} src={logo.dark} alt={label} className={cn('h-6 w-auto', className, 'hidden dark:block')} style={baseStyle} />
      </>
    )
  }

  return <img {...props} src={logo.light} alt={label} className={cn('h-6 w-auto', className, 'dark:invert')} style={baseStyle} />
}

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
    <footer className='border-border bg-background' style={{ borderTop: '1px var(--grid-line-style, solid) var(--border)' }}>
      <div className='mx-auto w-full max-w-full px-(--mobile-padding) py-10 lg:max-w-(--grid-max-width) lg:px-0'>
        {/* Top row: logo + social icons */}
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <Link href={logoLinkHref} className='no-underline flex items-center'>
            <Logo />
          </Link>
          {hasSocials && (
            <div className='flex items-center gap-3'>
              {Object.entries(socials).map(([platform, url]) => (
                <Link
                  key={platform}
                  href={url}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label={platform}
                  className='no-underline text-muted-foreground transition-colors duration-150 hover:text-foreground'
                >
                  <Icon icon={getDefaultTypeIcon(platform, site.config.icons.library) || 'link'} size={16} />
                </Link>
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
                  <div className='text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1'>
                    {column.header}
                  </div>
                )}
                {column.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    target={item.href.startsWith('http') ? '_blank' : undefined}
                    rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className='no-underline text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground'
                  >
                    {item.label}
                  </Link>
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
    <div className='flex items-center justify-center pt-6 pb-12'>
      <Link
        href='https://holocron.so?utm_source=powered-by'
        target='_blank'
        rel='noopener noreferrer'
        className='no-underline flex items-baseline gap-1 text-xs opacity-40 hover:opacity-70 transition-opacity duration-150'
      >
        <span>Powered by</span>
        <span className='font-bold'>Holocron</span>
      </Link>
    </div>
  )
}
