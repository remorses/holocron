// Reusable Input and NativeSelect components with consistent styling.

import type * as React from 'react'
import { cn } from '../../lib/utils.ts'

const sharedInputClasses = 'h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring'

export function Input({
  className,
  ...props
}: React.ComponentProps<'input'>): React.ReactElement {
  return (
    <input
      className={cn(sharedInputClasses, 'w-full', className)}
      {...props}
    />
  )
}

export function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<'select'>): React.ReactElement {
  return (
    <select
      className={cn(sharedInputClasses, 'appearance-none bg-no-repeat bg-[length:16px_16px] bg-[position:right_8px_center] pr-8', className)}
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
      }}
      {...props}
    >
      {children}
    </select>
  )
}
