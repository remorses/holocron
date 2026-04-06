'use client'

/**
 * Theme toggle button — switches between light and dark mode.
 * Writes a cookie so the server can render the correct class on <html>.
 * Listens to OS preference changes when no explicit cookie is set.
 * Hidden when `appearance.strict` is true.
 */

import React, { useCallback, useSyncExternalStore } from 'react'
import { serialize } from 'cookie'

function getTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function hasExplicitCookie(): boolean {
  return document.cookie.includes('holocron-theme=')
}

function subscribe(cb: () => void) {
  // Watch class changes on <html>
  const observer = new MutationObserver(cb)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

  // Track OS preference changes when no explicit cookie override exists.
  // If the user manually toggled, the cookie is set and we stop reacting
  // to OS changes — their explicit choice wins.
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const onSystemChange = (e: MediaQueryListEvent) => {
    if (hasExplicitCookie()) return
    document.documentElement.classList.toggle('dark', e.matches)
    cb()
  }
  media.addEventListener('change', onSystemChange)

  return () => {
    observer.disconnect()
    media.removeEventListener('change', onSystemChange)
  }
}

function setTheme(theme: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.cookie = serialize('holocron-theme', theme, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  })
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'light')

  const toggle = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme])

  return (
    <button
      type='button'
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className='inline-flex items-center justify-center rounded-md p-1.5 text-(color:--text-secondary) transition-colors duration-150 hover:text-(color:--text-primary) hover:bg-(color:--selection-bg)'
    >
      {theme === 'dark' ? (
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <circle cx='12' cy='12' r='4' />
          <path d='M12 2v2' />
          <path d='M12 20v2' />
          <path d='m4.93 4.93 1.41 1.41' />
          <path d='m17.66 17.66 1.41 1.41' />
          <path d='M2 12h2' />
          <path d='M20 12h2' />
          <path d='m6.34 17.66-1.41 1.41' />
          <path d='m19.07 4.93-1.41 1.41' />
        </svg>
      ) : (
        <svg width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
          <path d='M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' />
        </svg>
      )}
    </button>
  )
}
