// Reusable Input component with consistent styling.

import type * as React from 'react'
import { cn } from '../../lib/utils.ts'

export function Input({
  className,
  ...props
}: React.ComponentProps<'input'>): React.ReactElement {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring',
        className,
      )}
      {...props}
    />
  )
}
