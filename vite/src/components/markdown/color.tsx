'use client'

/** Mintlify-compatible Color palette display components. */

import React from 'react'
import { SectionCard } from './shared.tsx'

export function Color({ children }: { children: React.ReactNode }) {
  return <div className='flex flex-col gap-3'>{children}</div>
}

export function ColorRow({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <SectionCard>
      <div className='flex flex-col gap-3'>
        {title && <div className='text-sm font-semibold text-foreground'>{title}</div>}
        <div className='flex flex-wrap gap-3'>{children}</div>
      </div>
    </SectionCard>
  )
}

export function ColorItem({
  name,
  value,
}: {
  name?: string
  value: string | { light?: string; dark?: string }
}) {
  const light = typeof value === 'string' ? value : value.light ?? value.dark ?? '#cccccc'
  const dark = typeof value === 'string' ? value : value.dark ?? value.light ?? '#666666'
  return (
    <div className='flex min-w-[120px] flex-col gap-2'>
      <div className='h-14 rounded-lg border border-border-subtle' style={{ background: `linear-gradient(90deg, ${light} 0%, ${light} 50%, ${dark} 50%, ${dark} 100%)` }} />
      {name && <div className='text-xs font-medium text-foreground'>{name}</div>}
      <code className='inline-code text-[11px]'>{typeof value === 'string' ? value : `${light} / ${dark}`}</code>
    </div>
  )
}
