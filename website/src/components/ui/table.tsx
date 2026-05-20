// Table components copied from Sigillo — same styles for consistent look.
// Supports Frame-aware styling via data-slot selectors.

import type * as React from 'react'
import { cn } from '../../lib/utils.ts'

export function Table({
  className,
  ...props
}: React.ComponentProps<'table'>): React.ReactElement {
  return (
    <div
      className="relative w-full overflow-x-auto"
      data-slot="table-container"
    >
      <table
        className={cn(
          'w-full caption-bottom in-data-[slot=frame]:border-separate in-data-[slot=frame]:border-spacing-0 text-sm',
          className,
        )}
        data-slot="table"
        {...props}
      />
    </div>
  )
}

export function TableHeader({
  className,
  ...props
}: React.ComponentProps<'thead'>): React.ReactElement {
  return (
    <thead
      className={cn(
        '[&_tr]:border-b in-data-[slot=frame]:**:[th]:h-9 in-data-[slot=frame]:*:[tr]:border-none in-data-[slot=frame]:*:[tr]:hover:bg-transparent',
        className,
      )}
      data-slot="table-header"
      {...props}
    />
  )
}

export function TableBody({
  className,
  ...props
}: React.ComponentProps<'tbody'>): React.ReactElement {
  return (
    <tbody
      className={cn(
        "relative in-data-[slot=frame]:rounded-xl in-data-[slot=frame]:shadow-xs/5 before:pointer-events-none before:absolute before:inset-px not-in-data-[slot=frame]:before:hidden before:rounded-[calc(var(--radius-xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/8%)] [&_tr:last-child]:border-0 in-data-[slot=frame]:*:[tr]:border-0 in-data-[slot=frame]:*:[tr]:*:[td]:border-b in-data-[slot=frame]:*:[tr]:*:[td]:bg-background in-data-[slot=frame]:*:[tr]:*:[td]:bg-clip-padding in-data-[slot=frame]:*:[tr]:first:*:[td]:first:rounded-ss-xl in-data-[slot=frame]:*:[tr]:*:[td]:first:border-s in-data-[slot=frame]:*:[tr]:first:*:[td]:border-t in-data-[slot=frame]:*:[tr]:last:*:[td]:last:rounded-ee-xl in-data-[slot=frame]:*:[tr]:*:[td]:last:border-e in-data-[slot=frame]:*:[tr]:first:*:[td]:last:rounded-se-xl in-data-[slot=frame]:*:[tr]:last:*:[td]:first:rounded-es-xl in-data-[slot=frame]:*:[tr]:data-[state=selected]:*:[td]:bg-muted/72",
        className,
      )}
      data-slot="table-body"
      {...props}
    />
  )
}

export function TableRow({
  className,
  ...props
}: React.ComponentProps<'tr'>): React.ReactElement {
  return (
    <tr
      className={cn(
        'border-b transition-colors data-[state=selected]:bg-muted/72 in-data-[slot=frame]:data-[state=selected]:bg-transparent',
        className,
      )}
      data-slot="table-row"
      {...props}
    />
  )
}

export function TableHead({
  className,
  ...props
}: React.ComponentProps<'th'>): React.ReactElement {
  return (
    <th
      className={cn(
        'h-10 whitespace-nowrap px-2.5 text-left align-middle font-medium text-muted-foreground leading-none has-[[role=checkbox]]:w-px has-[[role=checkbox]]:pe-0',
        className,
      )}
      data-slot="table-head"
      {...props}
    />
  )
}

export function TableCell({
  className,
  ...props
}: React.ComponentProps<'td'>): React.ReactElement {
  return (
    <td
      className={cn(
        'whitespace-nowrap p-2.5 align-middle leading-none in-data-[slot=frame]:first:p-[calc(--spacing(2.5)-1px)] in-data-[slot=frame]:last:p-[calc(--spacing(2.5)-1px)] has-[[role=checkbox]]:pe-0',
        className,
      )}
      data-slot="table-cell"
      {...props}
    />
  )
}
