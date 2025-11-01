'use client'

import React, { useEffect, useState } from 'react'
import { href } from 'react-router'
import { useHydrated } from './hooks'
import { cn } from './utils'

// simple in-memory cache so every icon svg is fetched only once
const svgCache: Record<string, string> = {}

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
  const hydrated = useHydrated()
  const [svgContent, setSvgContent] = useState<string | null>(svgCache[name || ''] || null)

  useEffect(() => {
    if (!name || isEmoji(name) || isUrl(name)) {
      return
    }

    if (svgCache[name]) {
      setSvgContent(svgCache[name])
      return
    }

    const iconUrl = href('/api/icons/:provider/icon/:icon.svg', { provider: 'lucide', icon: name })
    fetch(iconUrl, {
      cache: 'force-cache',
    })
      .then(async (res) => {
        if (!res.ok) {
          return null
        }
        const svg = await res.text()
        svgCache[name] = svg
        setSvgContent(svg)
      })
      .catch(() => {
        setSvgContent(null)
      })
  }, [name])

  if (!hydrated) return <EmptyIcon />
  if (!name) return null

  // Handle emoji
  if (isEmoji(name)) {
    return (
      <span
        className={cn(rest.className, 'inline-flex items-center justify-center')}
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
        className={cn(rest.className, 'size-4 object-contain')}
      />
    )
  }

  // Handle Lucide icon via local API
  if (!svgContent) {
    return <EmptyIcon />
  }

  return (
    <div
      {...rest as any}
      className={cn(rest.className, 'inline-flex items-center justify-center')}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  )
}

function EmptyIcon() {
  return <div className='size-4' />
}

export function DynamicIcon({ icon: name, ...rest }: DynamicIconProps) {
  return <DynamicIconInner icon={name} {...rest} />
}
