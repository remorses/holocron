'use client'

/**
 * Editorial table primitives for native markdown tables, plus the bespoke
 * ComparisonTable used by some docs pages.
 */

import type { ComponentProps } from 'react'

function classNames(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div
      data-slot='table-container'
      className='no-bleed relative w-full overflow-x-auto rounded-(--border-radius-md) border border-(--border-subtle) bg-background'
    >
      <table
        data-slot='table'
        className={classNames(
          'w-full min-w-full border-collapse text-left text-sm text-(color:--text-primary) [&_caption]:px-3 [&_caption]:py-3 [&_caption]:text-sm [&_caption]:text-(color:--text-secondary) [&_thead_tr]:border-b [&_thead_tr]:border-(--page-border) [&_tbody_tr:last-child]:border-0 [&_tr]:border-b [&_tr]:border-(--page-border) [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-muted/30 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:align-middle [&_th]:text-xs [&_th]:font-medium [&_th]:whitespace-nowrap [&_th]:text-(color:--text-secondary) [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_tfoot]:border-t [&_tfoot]:border-(--page-border) [&_tfoot]:bg-muted/40 [&_tfoot]:font-medium [&>tbody:first-of-type>tr:first-child]:border-b [&>tbody:first-of-type>tr:first-child]:border-(--page-border) [&>tbody:first-of-type>tr:first-child>td]:text-xs [&>tbody:first-of-type>tr:first-child>td]:font-medium [&>tbody:first-of-type>tr:first-child>td]:whitespace-nowrap [&>tbody:first-of-type>tr:first-child>td]:text-(color:--text-secondary)',
          className,
        )}
        {...props}
      />
    </div>
  )
}

export function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot='table-header' className={classNames('[&_tr]:border-b [&_tr]:border-(--page-border)', className)} {...props} />
}

export function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody data-slot='table-body' className={classNames('[&_tr:last-child]:border-0', className)} {...props} />
}

export function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot='table-footer'
      className={classNames('border-t border-(--page-border) bg-muted/40 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  )
}

export function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot='table-row'
      className={classNames('border-b border-(--page-border) transition-colors hover:bg-muted/30 data-[state=selected]:bg-muted/50', className)}
      {...props}
    />
  )
}

export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      data-slot='table-head'
      className={classNames('px-3 py-2 text-left align-middle text-xs font-medium whitespace-nowrap text-(color:--text-secondary)', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      data-slot='table-cell'
      className={classNames('px-3 py-2 align-top', className)}
      {...props}
    />
  )
}

export function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption
      data-slot='table-caption'
      className={classNames('px-3 py-3 text-sm text-(color:--text-secondary)', className)}
      {...props}
    />
  )
}

export function ComparisonTable({
  title,
  headers,
  rows,
}: {
  title?: string
  headers: [string, string, string]
  rows: Array<[string, string, string]>
}) {
  return (
    <div className='w-full max-w-full overflow-x-auto'>
      {title && (
        <div
          style={{
            fontFamily: 'var(--font-primary)',
            fontSize: 'var(--type-table-size)',
            fontWeight: 'var(--weight-regular)',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--ls-code)',
            padding: '0 0 6px',
          }}
        >
          {title}
        </div>
      )}
      <table
        className='w-full'
        style={{
          borderSpacing: 0,
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr>
            {headers.map((header) => {
              return (
                <th
                  key={header}
                  className='text-left'
                  style={{
                    padding: '4px 12px 4px 0',
                    fontSize: 'var(--type-table-size)',
                    fontWeight: 'var(--weight-regular)',
                    fontFamily: 'var(--font-primary)',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--page-border)',
                  }}
                >
                  {header}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(([feature, them, us]) => {
            return (
              <tr key={feature}>
                <td
                  style={{
                    padding: '4px 12px 4px 0',
                    fontSize: 'var(--type-table-size)',
                    fontWeight: 'var(--weight-prose)',
                    fontFamily: 'var(--font-code)',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--page-border)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {feature}
                </td>
                <td
                  style={{
                    padding: '4px 12px 4px 0',
                    fontSize: 'var(--type-table-size)',
                    fontWeight: 'var(--weight-prose)',
                    fontFamily: 'var(--font-code)',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--page-border)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {them}
                </td>
                <td
                  style={{
                    padding: '4px 12px 4px 0',
                    fontSize: 'var(--type-table-size)',
                    fontWeight: 'var(--weight-prose)',
                    fontFamily: 'var(--font-code)',
                    color: 'var(--text-primary)',
                    borderBottom: '1px solid var(--page-border)',
                  }}
                >
                  {us}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
