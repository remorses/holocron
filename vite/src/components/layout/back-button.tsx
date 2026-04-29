'use client'

/**
 * BackButton — fixed top-right circular button linking home.
 */

import React from 'react'
import { Link } from 'spiceflow/react'

export function BackButton() {
  return (
    <Link
      href='/'
      className='fixed top-5 right-5 z-[100000] flex items-center justify-center w-10 h-10 rounded-full no-underline'
      style={{
        background: 'var(--background)',
        color: 'var(--muted-foreground)',
        boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 8px, rgba(0, 0, 0, 0.04) 0px 4px 16px, rgba(0, 0, 0, 0.06) 0px 0px 0px 1px inset',
        transition: 'color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--foreground)'
        e.currentTarget.style.transform = 'scale(1.05)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--muted-foreground)'
        e.currentTarget.style.transform = 'scale(1)'
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = 'scale(0.95)'
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)'
      }}
    >
      <svg width='14' height='14' viewBox='0 0 14 14' fill='none'>
        <path
          d='M12.25 7H1.75M1.75 7L6.125 2.625M1.75 7L6.125 11.375'
          stroke='currentColor'
          strokeWidth='1.5'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </Link>
  )
}
