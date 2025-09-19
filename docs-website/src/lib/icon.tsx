'use client'

import React, { lazy, Suspense } from 'react'
import { prefetchDNS, preconnect } from 'react-dom'
import { useHydrated } from './hooks'
import { lucideVersion } from './utils'

// simple in-memory cache so every icon is fetched only once
const cache: Record<string, React.ComponentType<any>> = {}

type DynamicIconProps = { icon?: string } & React.SVGProps<SVGSVGElement>

// Check if string is an emoji
function isEmoji(str: string): boolean {
  // Check for single emoji characters or short emoji sequences
  // This regex covers most common emoji ranges including emoticons, symbols, flags, etc.
  const emojiRegex = /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*$/u

  // Fallback for environments that don't support Unicode property escapes
  if (!emojiRegex.test) {
    // Basic emoji detection for older environments
    return /^[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]$/u.test(str)
  }

  return emojiRegex.test(str)
}

// Check if string is a URL
function isUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function DynamicIconInner({ icon: name, ...rest }: DynamicIconProps) {
  prefetchDNS('https://esm.sh')
  preconnect('https://esm.sh')
  const hydrated = useHydrated()
  if (!hydrated) return <EmptyIcon />
  if (!name) return null

  // Handle emoji
  if (isEmoji(name)) {
    return (
      <span
        className={(rest.className ?? '') + ' inline-flex items-center justify-center'}
        style={{ fontSize: '16px' }}
      >
        {name}
      </span>
    )
  }

  // Handle image URL
  if (isUrl(name)) {
    return (
      <img
        src={name}
        alt="icon"
        {...rest as any}
        className={(rest.className ?? '') + 'size-4 object-contain'}
      />
    )
  }

  // Handle Lucide icon
  const Icon =
    cache[name] ||
    (cache[name] = lazy(() =>
      import(
        /* @vite-ignore */
        `https://esm.sh/lucide-react@${lucideVersion}/es2022/dist/esm/icons/${name}.mjs`
      ).catch((e) => ({ default: EmptyIcon })),
    ))

  if (!Icon || EmptyIcon === Icon) {
    return null
  }
  return <Icon {...rest} className={(rest.className ?? '') + ' w-full'} />
}

function EmptyIcon() {
  return <div className='size-4' />
}

export function DynamicIcon({ icon: name, ...rest }: DynamicIconProps) {
  return (
    <Suspense fallback={<span className='block w-4 h-4 rounded transition-opacity opacity-0' />}>
      <DynamicIconInner icon={name} {...rest} />
    </Suspense>
  )
}
