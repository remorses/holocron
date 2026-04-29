'use client'

/** Dismiss button for the top banner. Sets a cookie and reloads. */

import React from 'react'
import { serialize } from 'cookie'

export function BannerDismiss({ content }: { content: string }) {
  return (
    <button
      type='button'
      onClick={() => {
        document.cookie = serialize('holocron-banner-dismissed', content, {
          path: '/',
          maxAge: 31536000,
          sameSite: 'lax',
        })
        window.location.reload()
      }}
      aria-label='Dismiss banner'
      className='shrink-0 rounded p-0.5 text-white opacity-70 transition-opacity hover:opacity-100'
    >
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M18 6 6 18' />
        <path d='m6 6 12 12' />
      </svg>
    </button>
  )
}
