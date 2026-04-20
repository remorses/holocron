'use client'

/**
 * Layout primitives: Bleed wrapper, Divider, Section, ordered/unordered
 * lists, and list items.
 */

import React from 'react'
import { SectionHeading, type HeadingLevel } from './typography.tsx'

export function Bleed({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginLeft: 'calc(-1 * var(--bleed))',
        marginRight: 'calc(-1 * var(--bleed))',
        display: 'flex',
        justifyContent: 'center',
        maxWidth: 'calc(100% + 2 * var(--bleed))',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  )
}

export function Divider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <div style={{ height: '1px', background: 'var(--divider)', flex: 1 }} />
    </div>
  )
}

export function Section({
  id,
  title,
  level = 1,
  children,
}: {
  id: string
  title: string
  level?: HeadingLevel
  children: React.ReactNode
}) {
  return (
    <>
      <SectionHeading id={id} level={level}>
        {title}
      </SectionHeading>
      {children}
    </>
  )
}

export function OL({ children }: { children: React.ReactNode }) {
  return <ol className='no-bleed editorial-prose pl-5 flex flex-col gap-(--list-gap)' style={{ listStyleType: 'decimal' }}>{children}</ol>
}

export function List({ children }: { children: React.ReactNode }) {
  return <ul className='no-bleed editorial-prose pl-5 flex flex-col gap-(--list-gap)' style={{ listStyleType: 'disc' }}>{children}</ul>
}

// Li has no vertical padding — the parent ul/ol uses `gap-(--list-gap)`
// for inter-item spacing so first/last items get zero edge space.
export function Li({ children }: { children: React.ReactNode }) {
  return <li className='ps-1'>{children}</li>
}
