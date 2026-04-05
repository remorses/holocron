'use client'

/**
 * Editorial typography primitives: headings, prose paragraph, caption,
 * inline link, inline code.
 */

import React from 'react'

export type HeadingLevel = 1 | 2 | 3

const headingTagByLevel: Record<HeadingLevel, 'h1' | 'h2' | 'h3'> = {
  1: 'h1',
  2: 'h2',
  3: 'h3',
}

const headingClassByLevel: Record<HeadingLevel, string> = {
  1: 'editorial-heading editorial-h1',
  2: 'editorial-heading editorial-h2',
  3: 'editorial-heading editorial-h3',
}

export function SectionHeading({
  id,
  level = 1,
  children,
}: {
  id: string
  level?: HeadingLevel
  children: React.ReactNode
}) {
  level ||= 1
  const Tag = headingTagByLevel[level] || 'h4'

  return (
    <Tag
      id={id}
      className={headingClassByLevel[level] || 'editorial-heading'}
      data-toc-heading='true'
      data-toc-level={level}
    >
      <span style={{ whiteSpace: level === 1 ? 'nowrap' : 'normal' }}>{children}</span>
      {level === 1 ? <span style={{ flex: 1, height: '1px', background: 'var(--divider)' }} /> : null}
    </Tag>
  )
}

// Uses <div> instead of <p> to avoid hydration mismatches when MDX content
// contains explicit <p> or <h1> tags whose text children also get wrapped
// by this component (p→P mapping), creating invalid nested <p> elements.
export function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`editorial-prose ${className}`}
      style={{ opacity: 0.82 }}
    >
      {children}
    </div>
  )
}

export function Caption({ children }: { children: React.ReactNode }) {
  return (
    <div
      className='editorial-prose'
      style={{
        fontSize: 'var(--type-caption-size)',
        textAlign: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </div>
  )
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target='_blank'
      rel='noopener noreferrer'
      style={{
        color: 'var(--link-accent, #0969da)',
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
    </a>
  )
}

export function Code({ children }: { children: React.ReactNode }) {
  return <code className='inline-code'>{children}</code>
}
