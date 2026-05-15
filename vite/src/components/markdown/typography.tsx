'use client'

/**
 * Editorial typography primitives: headings, prose paragraph, inline link,
 * inline code.
 */

import React, { Children, isValidElement } from 'react'
import { Link } from 'spiceflow/react'

import { cn } from '../../lib/css-vars.ts'
import { slugify } from '../../lib/toc-tree.ts'

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

const headingTagByLevel: Record<number, string> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
  4: 'h4',
  5: 'h5',
  6: 'h6',
}

const headingClassByLevel: Record<number, string> = {
  1: 'editorial-heading editorial-h1',
  2: 'editorial-heading editorial-h2',
  3: 'editorial-heading editorial-h3',
  4: 'editorial-heading',
  5: 'editorial-heading',
  6: 'editorial-heading',
}

function normalizeHeadingLevel(level: HeadingLevel | number | string | undefined): HeadingLevel {
  const parsedLevel = Number(level)
  if (!Number.isInteger(parsedLevel) || parsedLevel < 1 || parsedLevel > 6) {
    return 1
  }
  return parsedLevel as HeadingLevel
}

function extractTextFromReactNode(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node)
  }
  if (Array.isArray(node)) {
    return node.map((child) => extractTextFromReactNode(child)).join('')
  }
  if (isValidElement(node)) {
    return extractTextFromReactNode((node.props as { children?: React.ReactNode }).children)
  }
  return ''
}

export function SectionHeading({
  id,
  level = 1,
  children,
}: {
  id: string
  level?: number
  children: React.ReactNode
}) {
level ||= 1
  const tag = headingTagByLevel[level] || 'h4'
  const cls = headingClassByLevel[level] || 'editorial-heading'

  return React.createElement(tag, {
    id,
    className: cls,
    'data-toc-heading': 'true',
    'data-toc-level': level,
  },
    <span style={{ whiteSpace: level === 1 ? 'nowrap' : 'normal' }}>{children}</span>,
    level === 1 ? <span style={{ flex: 1, height: '1px', background: 'var(--divider)' }} /> : null,
  )
}

export function Heading({
  id,
  level = 1,
  noAnchor = false,
  children,
}: {
  id?: string
  level?: HeadingLevel | number | string
  noAnchor?: boolean
  children: React.ReactNode
}) {
  const resolvedLevel = normalizeHeadingLevel(level)
  const headingId = id || slugify(Children.toArray(children).map((child) => extractTextFromReactNode(child)).join(''))

  if (noAnchor) {
    const tag = headingTagByLevel[resolvedLevel] || 'h4'
    const className = headingClassByLevel[resolvedLevel] || 'editorial-heading'
    return React.createElement(tag, { id: headingId, className }, children)
  }

  return <SectionHeading id={headingId} level={resolvedLevel}>{children}</SectionHeading>
}

// Uses <div> instead of <p> to avoid hydration mismatches when MDX content
// contains explicit <p> or <h1> tags whose text children also get wrapped
// by this component (p→P mapping), creating invalid nested <p> elements.
export function P({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn('editorial-prose', className)}
      style={{ opacity: 0.82 }}
    >
      {children}
    </div>
  )
}

function isExternalHref(href: string): boolean {
  if (!href || href.startsWith('/') || href.startsWith('#') || href.startsWith('.')) return false
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
    if (typeof window !== 'undefined') return url.origin !== window.location.origin
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = isExternalHref(href)
  return (
    <Link
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      style={{
        color: 'var(--primary)',
        fontWeight: 'var(--weight-heading)',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.textDecoration = 'underline'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.textDecoration = 'none'
      }}
    >
      {children}
    </Link>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className='inline-code'>{children}</code>
}
