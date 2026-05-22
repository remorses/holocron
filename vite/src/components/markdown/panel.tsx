'use client'

/** Mintlify-compatible Panel container component. */

import React from 'react'

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className='rounded-lg border border-border-subtle bg-muted/20 p-4'>
      <div className='no-bleed flex flex-col gap-y-4 text-sm text-muted-foreground'>
        {children}
      </div>
    </div>
  )
}
