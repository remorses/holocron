'use client'

/** Mintlify-compatible View component for alternative content blocks. */

import React from 'react'
import { Icon } from '../../icon.tsx'
import { SectionCard } from './shared.tsx'

export function View({ title, icon, iconType, children }: { title: string; icon?: string; /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */ iconType?: string; children: React.ReactNode }) {
  return (
    <SectionCard>
      <div className='flex flex-col gap-3'>
        <div className='flex items-center gap-2 text-sm font-semibold text-foreground'>
          {icon && <Icon icon={icon} iconType={iconType} size={16} />}
          <span>{title}</span>
        </div>
        <div className='flex flex-col gap-3 text-sm text-muted-foreground'>{children}</div>
      </div>
    </SectionCard>
  )
}
