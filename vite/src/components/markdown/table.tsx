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
          'w-full min-w-full border-collapse text-left text-sm text-foreground [&_caption]:px-3 [&_caption]:py-3 [&_caption]:text-sm [&_caption]:text-muted-foreground [&_thead_tr]:border-b [&_thead_tr]:border-border [&_tbody_tr:last-child]:border-0 [&_tr]:border-b [&_tr]:border-border [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/30 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-middle [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-muted-foreground [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_td]:min-w-[150px] [&_tfoot]:border-t [&_tfoot]:border-border [&_tfoot]:bg-muted/40 [&_tfoot]:font-medium [&>tbody:first-of-type>tr:first-child]:border-b [&>tbody:first-of-type>tr:first-child]:border-border [&>tbody:first-of-type>tr:first-child>td]:text-xs [&>tbody:first-of-type>tr:first-child>td]:font-medium [&>tbody:first-of-type>tr:first-child>td]:whitespace-nowrap [&>tbody:first-of-type>tr:first-child>td]:text-muted-foreground',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot='table-header' className={classNames('[&_tr]:border-b [&_tr]:border-border', className)} {...props} />
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot='table-body' className={classNames('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={classNames('border-t border-border bg-muted/40 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot='table-row'
      className={classNames('border-b border-border transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted/50', className)}
      {...props}
    />
  )
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      data-slot='table-head'
      className={classNames('px-3 py-2 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      data-slot='table-cell'
      className={classNames('px-3 py-2 align-top min-w-[150px]', className)}
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
