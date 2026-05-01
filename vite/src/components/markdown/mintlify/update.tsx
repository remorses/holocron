'use client'

/** Mintlify-compatible changelog Update component. */

import React from 'react'
import { Link } from 'spiceflow/react'
import { slugify } from '../../../lib/toc-tree.ts'
import { Badge } from './badge.tsx'

export function Update({
  label,
  description,
  tags,
  rss: _rss,
  children,
}: {
  label: string
  description?: string
  tags?: string[]
  /** Accepted for Mintlify compat — Holocron does not render RSS-only metadata. */
  rss?: { title?: string; description?: string }
  children: React.ReactNode
}) {
  // Mintlify-style two-column changelog row:
  //   - left rail (sticky on lg+): label pill + description + tags
  //   - right column: MDX children (headings, frames, code blocks, lists…)
  //
  // Holocron content column is ~520px, so the rail is 110px (not 160px like
  // Mintlify) to leave enough room for code blocks / Frames in children.
  // `min-w-0` on the content wrapper is required so flexbox can actually
  // shrink the content below its intrinsic size and avoid horizontal bleed.
  // `no-bleed` prevents nested code blocks / lists from escaping the column.
  const id = slugify(label)
  return (
    <div
      id={id}
      data-component-part='update'
      className='flex w-full flex-col items-start gap-3 py-6 lg:flex-row lg:gap-5 lg:py-8'
    >
      <div className='flex w-full flex-col items-start gap-3 lg:sticky lg:top-(--sticky-top) lg:w-[110px] lg:flex-shrink-0'>
        <Link
          href={`#${id}`}
          data-component-part='update-label'
          className='inline-flex items-center rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary no-underline'
        >
          {label}
        </Link>
        {description && (
          <div
            data-component-part='update-description'
            className='text-xs break-words text-muted-foreground lg:max-w-[110px]'
          >
            {description}
          </div>
        )}
        {tags && tags.length > 0 && (
          <div className='flex flex-wrap gap-1'>
            {tags.map((tag) => (
              <Badge key={tag} color='gray' size='xs'>
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div
        data-component-part='update-content'
        className='no-bleed flex min-w-0 flex-1 flex-col gap-(--prose-gap)'
      >
        {children}
      </div>
    </div>
  )
}
