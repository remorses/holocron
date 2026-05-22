'use client'

/** Mintlify-compatible Visibility component for human-only web rendering. */

import React from 'react'

export function Visibility({ for: audience, children }: { for?: 'humans' | 'agents'; children?: React.ReactNode }) {
  if (audience === 'agents') return null
  return <>{children}</>
}
