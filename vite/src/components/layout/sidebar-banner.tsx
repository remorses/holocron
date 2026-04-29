'use client'

/**
 * SidebarBanner — Seline-style CTA card for the right gutter.
 * Tinted background, short text, full-width button, optional corner image.
 */

import React from 'react'
import { Link } from 'spiceflow/react'

export function SidebarBanner({
  text,
  buttonLabel,
  buttonHref,
  imageUrl,
}: {
  text: React.ReactNode
  buttonLabel: string
  buttonHref: string
  imageUrl?: string
}) {
  return (
    <div
      style={{
        position: 'relative',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg, var(--radius))',
        padding: '10px',
        fontSize: 'var(--type-small-size)',
        fontWeight: 'var(--weight-prose)',
        lineHeight: 'var(--lh-heading)',
        color: 'var(--sidebar-foreground)',
        overflow: 'visible',
      }}
    >
      {text}
      {(() => {
        const isExternal = buttonHref.startsWith('http')
        const bannerStyle = {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '32px',
          marginTop: '8px',
          borderRadius: 'var(--radius-lg, var(--radius))',
          fontSize: 'var(--type-small-size)',
          fontWeight: 'var(--weight-prose)',
          backgroundColor: 'var(--foreground)',
          color: 'var(--background)',
          textDecoration: 'none',
          position: 'relative' as const,
          zIndex: 2,
          transition: 'opacity 0.15s ease',
        }
        const handleEnter = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.opacity = '0.85' }
        const handleLeave = (e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.opacity = '1' }

        if (isExternal) {
          return (
            <a href={buttonHref} target='_blank' rel='noopener noreferrer' className='no-underline' style={bannerStyle} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
              {buttonLabel}
            </a>
          )
        }
        return (
          <Link href={buttonHref} className='no-underline' style={bannerStyle} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
            {buttonLabel}
          </Link>
        )
      })()}
      {imageUrl && (
        <img
          src={imageUrl}
          alt=''
          width={144}
          height={144}
          style={{
            position: 'absolute',
            zIndex: 1,
            top: '-32px',
            right: '-32px',
            height: '120px',
            width: 'auto',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
