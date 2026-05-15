'use client'

/**
 * Editorial table primitives for native markdown tables.
 */

import type { ComponentProps } from 'react'
import { cn } from '../../lib/css-vars.ts'

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div data-slot='table-container' className='no-bleed relative w-full overflow-x-auto'>
      <table
        data-slot='table'
        className={cn(
          'w-full min-w-full caption-bottom text-left text-sm text-foreground',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot='table-header' className={cn('[&_tr]:border-b', className)} {...props} />
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot='table-body' className={cn('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={cn('border-t bg-transparent font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot='table-row'
      className={cn('border-b transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted/50', className)}
      {...props}
    />
  )
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      data-slot='table-head'
      className={cn('h-10 px-2.5 first:pl-0 last:pr-0 text-left align-middle font-medium whitespace-nowrap text-muted-foreground', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      data-slot='table-cell'
      className={cn('min-w-[150px] p-2.5 first:pl-0 last:pr-0 align-top', className)}
      {...props}
    />
  )
}

export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}
