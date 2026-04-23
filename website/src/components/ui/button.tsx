// Reusable shadcn-style button with Tailwind variants and form pending states.
'use client'

import { Slot } from 'radix-ui'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { useFormStatus } from 'react-dom'
import { cn } from '../../lib/utils.ts'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-lg px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    loadingText?: string
  }

export function Button({
  asChild = false,
  className,
  children,
  disabled,
  loading = false,
  loadingText,
  size,
  type,
  variant,
  ...props
}: ButtonProps) {
  const { pending } = useFormStatus()
  const isSubmit = type === 'submit'
  const isLoading = loading || (isSubmit && pending)
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      aria-busy={isLoading || undefined}
      className={cn(buttonVariants({ variant, size }), isLoading && 'cursor-wait', className)}
      disabled={asChild ? undefined : disabled || isLoading}
      type={asChild ? undefined : type}
      {...props}
    >
      {isLoading ? loadingText ?? 'Loading...' : children}
    </Comp>
  )
}
