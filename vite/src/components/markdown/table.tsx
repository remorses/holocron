'use client'

/**
 * ComparisonTable — 3-column table for comparing features across products.
 */

import React from 'react'

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
