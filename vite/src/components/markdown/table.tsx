'use client'

/**
 * Editorial table primitives for native markdown tables.
 */

import type { ComponentProps } from 'react'

function classNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div
      data-slot='table-container'
      className='no-bleed relative w-full overflow-x-auto rounded-lg border border-border-subtle bg-background'
    >
      <table
        data-slot='table'
        className={classNames(
          'w-full min-w-full border-separate border-spacing-0 text-left text-sm text-foreground [&_caption]:px-3 [&_caption]:py-3 [&_caption]:text-sm [&_caption]:text-muted-foreground',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot='table-header' className={className} {...props} />
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot='table-body' className={classNames('[&_tr:last-child>*]:border-b-0', className)} {...props} />
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={classNames('bg-muted/40 font-medium [&>tr>*]:border-t [&>tr>*]:border-b-0 [&>tr>*]:border-border', className)}
      {...props}
    />
  )
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot='table-row'
      className={classNames('transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted/50', className)}
      {...props}
    />
  )
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      data-slot='table-head'
      className={classNames('border-b border-border px-3 py-2 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      data-slot='table-cell'
      className={classNames('min-w-[150px] border-b border-border px-3 py-2 align-top', className)}
      {...props}
    />
  )
}

export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={classNames('px-3 py-3 text-sm text-muted-foreground', className)}
      {...props}
    />
  )
}
