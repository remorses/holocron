'use client'

/**
 * Theme select — native <select> with System / Light / Dark, shown in the footer.
 * Writes a `color-theme` cookie so THEME_SCRIPT sets the right class on
 * <html> on the next load. "system" follows the OS preference live.
 * Hidden when `appearance.strict` is true.
 */

import React, { useEffect, useSyncExternalStore } from 'react'
import { serialize } from 'cookie'
import { cn } from '../lib/css-vars.ts'

type ThemePreference = 'system' | 'light' | 'dark'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const listeners = new Set<() => void>()

function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

function getPreference(): ThemePreference {
  const fromCookie = document.cookie.match(/(?:^|;\s*)color-theme=(light|dark|system)/)?.[1]
  if (isThemePreference(fromCookie)) return fromCookie
  const fallback = document.documentElement.getAttribute('data-default-theme')
  return isThemePreference(fallback) ? fallback : 'system'
}

const getServerPreference = (): ThemePreference => 'system'

function applyResolvedTheme(preference: ThemePreference) {
  const dark = preference === 'system' ? window.matchMedia('(prefers-color-scheme: dark)').matches : preference === 'dark'
  document.documentElement.classList.toggle('dark', dark)
}

function setPreference(preference: ThemePreference) {
  document.cookie = serialize('color-theme', preference, {
    path: '/',
    maxAge: 31536000,
    sameSite: 'lax',
  })
  applyResolvedTheme(preference)
  for (const listener of listeners) listener()
}

function onSystemChange() {
  if (getPreference() === 'system') applyResolvedTheme('system')
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', onSystemChange)
  return () => {
    listeners.delete(cb)
    media.removeEventListener('change', onSystemChange)
  }
}

/** Pressing `d` anywhere (unless typing) flips between light and dark. */
function onThemeKeyDown(e: KeyboardEvent) {
  if (e.defaultPrevented) return
  if (e.key !== 'd' && e.key !== 'D') return
  if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
  const target = e.target
  if (target instanceof HTMLElement) {
    if (target.isContentEditable) return
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
  }
  e.preventDefault()
  setPreference(document.documentElement.classList.contains('dark') ? 'light' : 'dark')
}

function onSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
  const value = e.target.value
  if (isThemePreference(value)) setPreference(value)
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  const common = {
    'aria-hidden': true,
    width: 11,
    height: 11,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const
  if (preference === 'light') {
    return (
      <svg {...common}>
        <circle cx='12' cy='12' r='5' />
        <path fill='none' d='M12 1.5v1.5M12 21v1.5M4.57 4.57l1.06 1.06m12.74 12.74 1.06 1.06M1.5 12H3m18 0h1.5M4.57 19.43l1.06-1.06M18.37 5.63l1.06-1.06' />
      </svg>
    )
  }
  if (preference === 'dark') {
    return (
      <svg {...common}>
        <path transform='translate(12 12) scale(0.75) translate(-12 -12)' d='M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z' />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect width='20' height='14' x='2' y='3' rx='2' />
      <path fill='none' d='M8 21h8m-4-4v4' />
    </svg>
  )
}

export function ThemeSelect({ className }: { className?: string }) {
  const preference = useSyncExternalStore(subscribe, getPreference, getServerPreference)

  useEffect(() => {
    document.addEventListener('keydown', onThemeKeyDown)
    return () => document.removeEventListener('keydown', onThemeKeyDown)
  }, [])

  const label = THEME_OPTIONS.find((o) => o.value === preference)?.label

  return (
    <div
      className={cn(
        'relative inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:text-foreground hover:bg-accent has-focus-visible:outline-2 has-focus-visible:outline-ring',
        className,
      )}
    >
      <ThemeIcon preference={preference} />
      <span>{label}</span>
      {/* Inline SVG — data-URI SVGs can't inherit currentColor */}
      <svg aria-hidden='true' viewBox='0 0 24 24' width={10} height={10} fill='none' stroke='currentColor' strokeWidth={2} strokeLinecap='round' strokeLinejoin='round' className='shrink-0'>
        <path d='m6 9 6 6 6-6' />
      </svg>
      <select
        aria-label='Color theme'
        value={preference}
        onChange={onSelectChange}
        className='absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 outline-none'
      >
        {THEME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
