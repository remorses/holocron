'use client'

/**
 * Minimal Mintlify compatibility components.
 *
 * These prioritize safe rendering and fixture coverage over exact visual parity.
 * All icon rendering goes through the shared <Icon> component which handles
 * emoji, URL, and atlas-based icons with iconType/color dispatch.
 */

import React from 'react'
import { Icon } from '../../icon.tsx'
import { Chevron } from './chevron.tsx'
import { slugify } from '../../../lib/toc-tree.ts'

function sectionCard(children: React.ReactNode, className = '') {
  return (
    <div className={`no-bleed flex flex-col gap-3 rounded-(--border-radius-md) border border-(--border-subtle) bg-card p-4 ${className}`.trim()}>
      {children}
    </div>
  )
}

function resolveColumns(cols: number | undefined) {
  const value = Math.min(Math.max(cols ?? 2, 1), 4)
  return `repeat(${value}, minmax(0, 1fr))`
}

export function Badge({
  children,
  color = 'gray',
  icon,
  iconType,
  size,
  shape = 'rounded',
  stroke,
  disabled,
  className = '',
}: {
  children: React.ReactNode
  color?: string
  icon?: string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  shape?: 'rounded' | 'pill'
  stroke?: boolean
  disabled?: boolean
  className?: string
}) {
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]'
    : size === 'sm' ? 'px-2 py-0.5 text-[11px]'
    : size === 'lg' ? 'px-3 py-1 text-[13px]'
    : 'px-2 py-0.5 text-[11px]'
  const shapeClass = shape === 'pill' ? 'rounded-full' : 'rounded-md'

  if (color === 'gray' || color === 'surface') {
    return (
      <span className={`inline-flex w-fit self-start items-center gap-1 border ${sizeClass} ${shapeClass} bg-muted text-(color:--text-primary) border-(--border-subtle) ${disabled ? 'opacity-50' : ''} ${className}`}>
        {icon && <Icon icon={icon} iconType={iconType} size={size === 'xs' ? 10 : size === 'lg' ? 14 : 12} />}
        {children}
      </span>
    )
  }
  if (color === 'white') {
    return (
      <span className={`inline-flex w-fit self-start items-center gap-1 border ${sizeClass} ${shapeClass} bg-white/85 text-neutral-900 dark:text-neutral-100 border-black/8 ${disabled ? 'opacity-50' : ''} ${className}`}>
        {icon && <Icon icon={icon} iconType={iconType} size={size === 'xs' ? 10 : size === 'lg' ? 14 : 12} />}
        {children}
      </span>
    )
  }
  const destructive = color === 'white-destructive' || color === 'surface-destructive'
  if (destructive) {
    return (
      <span className={`inline-flex w-fit self-start items-center gap-1 border ${sizeClass} ${shapeClass} bg-brand-red/10 text-brand-red border-brand-red/20 ${disabled ? 'opacity-50' : ''} ${className}`}>
        {icon && <Icon icon={icon} iconType={iconType} size={size === 'xs' ? 10 : size === 'lg' ? 14 : 12} color="var(--brand-red)" />}
        {children}
      </span>
    )
  }
  const cls: Record<string, string> = {
    blue: stroke ? 'text-brand-blue border-brand-blue' : 'bg-brand-blue/10 text-brand-blue border-brand-blue/20',
    green: stroke ? 'text-brand-green border-brand-green' : 'bg-brand-green/10 text-brand-green border-brand-green/20',
    yellow: stroke ? 'text-brand-yellow border-brand-yellow' : 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20',
    orange: stroke ? 'text-brand-orange border-brand-orange' : 'bg-brand-orange/10 text-brand-orange border-brand-orange/20',
    red: stroke ? 'text-brand-red border-brand-red' : 'bg-brand-red/10 text-brand-red border-brand-red/20',
    purple: stroke ? 'text-brand-purple border-brand-purple' : 'bg-brand-purple/10 text-brand-purple border-brand-purple/20',
  }
  const variantCls = cls[color] ?? cls.blue
  return (
    <span
      className={`inline-flex w-fit self-start items-center gap-1 border ${sizeClass} ${shapeClass} ${variantCls} ${disabled ? 'opacity-50' : ''} ${className}`}
    >
      {icon && <Icon icon={icon} iconType={iconType} size={size === 'xs' ? 10 : size === 'lg' ? 14 : 12} />}
      {children}
    </span>
  )
}

export function Card({
  title,
  icon,
  iconType,
  color,
  href,
  horizontal,
  img,
  cta,
  arrow,
  children,
}: {
  title?: string
  icon?: string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  color?: string
  href?: string
  horizontal?: boolean
  img?: string
  cta?: string
  arrow?: boolean
  children?: React.ReactNode
}) {
  const content = (
    <div className={`flex h-full flex-col gap-2 rounded-(--border-radius-md) border border-(--border-subtle) bg-card p-4 ${horizontal ? 'flex-row items-center' : ''}`.trim()}>
      {img && <img src={img} alt='' className='w-full rounded-lg border border-(--border-subtle)' />}
      <div className='flex items-center gap-2'>
        {icon && <Icon icon={icon} iconType={iconType} size={16} color={color} />}
        {title && <div className='text-sm font-semibold text-(color:--text-primary)'>{title}</div>}
      </div>
      {children !== undefined && children !== null && <div className='flex flex-col gap-3 text-sm text-(color:--text-secondary)'>{children}</div>}
      {href && (cta || arrow) && <div className='text-xs text-(color:--brand-primary)'>{cta || (arrow ? '→' : undefined)}</div>}
    </div>
  )
  if (!href) return content
  return <a href={href} className='no-underline'>{content}</a>
}

export function Columns({ cols, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div className='grid gap-4' style={{ gridTemplateColumns: resolveColumns(cols) }}>
      {children}
    </div>
  )
}

export function CardGroup({ cols, children }: { cols?: number; children: React.ReactNode }) {
  // Mintlify authors use <CardGroup> as the card-grid primitive; keep it as
  // an explicit alias so MDX doesn't silently drop those sections.
  return <Columns cols={cols}>{children}</Columns>
}

export function Column({ children }: { children: React.ReactNode }) {
  return <div className='flex min-w-0 flex-col gap-3'>{children}</div>
}

export function Expandable({
  title = 'Expandable',
  defaultOpen = false,
  children,
}: {
  title?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  return (
    <details className='no-bleed group rounded-(--border-radius-md) border border-(--border-subtle) bg-card' open={defaultOpen}>
      <summary className='flex cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden'>
        <span>{title}</span>
        <Chevron />
      </summary>
      <div className='no-bleed flex flex-col gap-3 px-4 pb-4 text-sm text-(color:--text-secondary)'>{children}</div>
    </details>
  )
}

export function Frame({ caption, hint, children }: { caption?: string; hint?: string; children: React.ReactNode }) {
  return sectionCard(
    <div className='flex flex-col gap-3'>
      <div className='overflow-hidden rounded-lg border border-(--border-subtle) bg-muted/30 p-3'>{children}</div>
      {(caption || hint) && (
        <div className='flex flex-wrap items-center gap-2 text-xs text-(color:--text-secondary)'>
          {caption && <span>{caption}</span>}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </div>,
  )
}

export function Prompt({
  description,
  icon,
  iconType,
  actions,
  children,
}: {
  description: string
  icon?: string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  actions?: string[]
  children: React.ReactNode
}) {
  const plainText = typeof children === 'string' || typeof children === 'number'
  const showCopy = !actions || actions.includes('copy')
  return sectionCard(
    <div className='flex flex-col gap-3'>
      <div className='flex items-center gap-2'>
        {icon && <Icon icon={icon} iconType={iconType} size={16} />}
        <div className='text-xs font-semibold uppercase tracking-wide text-(color:--text-secondary)'>{description}</div>
      </div>
      <div
        className={plainText
          ? 'rounded-lg bg-muted/50 p-3 text-sm text-(color:--text-primary) [font-family:var(--font-code)] whitespace-pre-wrap'
          : 'flex flex-col gap-3 rounded-lg bg-muted/30 p-3 text-sm text-(color:--text-primary)'}
      >
        {children}
      </div>
      {showCopy && (
        <button
          type='button'
          className='self-end rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-(color:--text-secondary) hover:text-(color:--text-primary) transition-colors'
          onClick={() => { void navigator.clipboard.writeText(String(children)) }}
        >
          Copy
        </button>
      )}
    </div>,
  )
}

export function ParamField(props: {
  children: React.ReactNode
  type?: string
  required?: boolean
  deprecated?: boolean
  default?: string
  placeholder?: string
  path?: string
  query?: string
  body?: string
  header?: string
}) {
  const location = [
    ['path', props.path],
    ['query', props.query],
    ['body', props.body],
    ['header', props.header],
  ].find(([, value]) => value)
  const name = location?.[1] ?? 'field'
  return sectionCard(
    <div className='flex flex-col gap-2 text-sm'>
      <div className='flex flex-wrap items-center gap-2'>
        <code className='inline-code'>{location?.[0]} {name}</code>
        {props.type && <Badge color='surface'>{props.type}</Badge>}
        {props.required && <Badge color='green'>required</Badge>}
        {props.deprecated && <Badge color='orange'>deprecated</Badge>}
        {props.default && <Badge color='gray'>default: {props.default}</Badge>}
      </div>
      <div className='flex flex-col gap-3 text-(color:--text-secondary)'>{props.children}</div>
    </div>,
  )
}

export function ResponseField({
  name,
  type,
  required,
  deprecated,
  children,
}: {
  name: string
  type: string
  required?: boolean
  deprecated?: boolean
  children?: React.ReactNode
}) {
  return sectionCard(
    <div className='flex flex-col gap-2 text-sm'>
      <div className='flex flex-wrap items-center gap-2'>
        <code className='inline-code'>{name}</code>
        <Badge color='surface'>{type}</Badge>
        {required && <Badge color='green'>required</Badge>}
        {deprecated && <Badge color='orange'>deprecated</Badge>}
      </div>
      {children !== undefined && children !== null && <div className='flex flex-col gap-3 text-(color:--text-secondary)'>{children}</div>}
    </div>,
  )
}

export function Steps({ children, titleSize = 'p' }: { children: React.ReactNode; titleSize?: 'p' | 'h2' | 'h3' | 'h4' }) {
  return <ol className='m-0 flex list-decimal flex-col gap-4 ps-5'>{children}</ol>
}

export function Step({
  title,
  icon,
  iconType,
  children,
}: {
  title: string
  icon?: string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  children: React.ReactNode
}) {
  return (
    <li className='ps-1'>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center gap-2 text-sm font-semibold text-(color:--text-primary)'>
          {icon && <Icon icon={icon} iconType={iconType} size={16} />}
          {title}
        </div>
        <div className='no-bleed flex flex-col gap-3 text-sm text-(color:--text-secondary)'>{children}</div>
      </div>
    </li>
  )
}

export function Tile({
  href,
  title,
  description,
  children,
}: {
  href: string
  title?: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <a href={href} className='no-underline'>
      <div className='flex h-full flex-col gap-3 rounded-(--border-radius-md) border border-(--border-subtle) bg-card p-3'>
        <div className='overflow-hidden rounded-lg border border-(--border-subtle) bg-muted/40 p-2'>{children}</div>
        {title && <div className='text-sm font-semibold text-(color:--text-primary)'>{title}</div>}
        {description && <div className='text-xs text-(color:--text-secondary)'>{description}</div>}
      </div>
    </a>
  )
}

export function Tooltip({ tip, headline, cta, href, children }: { tip: string; headline?: string; cta?: string; href?: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  // safe-mdx wraps text children in P (a block div), so we extract
  // the text content and render it inline to avoid invalid div-inside-span.
  const inlineText = typeof children === 'string'
    ? children
    : typeof children === 'number'
      ? String(children)
      : undefined
  const trigger = inlineText !== undefined
    ? inlineText
    : children
  return (
    <span
      className='relative inline-flex w-fit cursor-help underline decoration-dotted decoration-(--text-secondary) underline-offset-2'
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {trigger}
      {open && (
        <span
          className='absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-(--border-radius-md) border border-(--border-subtle) bg-card px-3 py-2 text-sm text-(color:--text-primary) shadow-lg'
          role='tooltip'
        >
          {headline && <div className='mb-1 text-xs font-semibold'>{headline}</div>}
          <div>{tip}</div>
          {cta && href && (
            <a href={href} className='mt-1 inline-block text-xs text-(color:--brand-primary) hover:underline'>{cta}</a>
          )}
        </span>
      )}
    </span>
  )
}

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
        <a
          href={`#${id}`}
          data-component-part='update-label'
          className='inline-flex items-center rounded-(--border-radius-md) bg-(--brand-primary)/10 px-2 py-0.5 text-xs font-medium text-(color:--brand-primary) no-underline'
        >
          {label}
        </a>
        {description && (
          <div
            data-component-part='update-description'
            className='text-xs break-words text-(color:--text-secondary) lg:max-w-[110px]'
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

export function View({ title, icon, iconType, children }: { title: string; icon?: string; /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */ iconType?: string; children: React.ReactNode }) {
  return sectionCard(
    <div className='flex flex-col gap-3'>
      <div className='flex items-center gap-2 text-sm font-semibold text-(color:--text-primary)'>
        {icon && <Icon icon={icon} iconType={iconType} size={16} />}
        <span>{title}</span>
      </div>
      <div className='flex flex-col gap-3 text-sm text-(color:--text-secondary)'>{children}</div>
    </div>,
  )
}

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className='rounded-(--border-radius-md) border border-(--border-subtle) bg-muted/20 p-4'>
      <div className='no-bleed flex flex-col gap-y-4 text-sm text-(color:--text-secondary)'>
        {children}
      </div>
    </div>
  )
}

export function RequestExample({ children, dropdown }: { children: React.ReactNode; dropdown?: boolean }) {
  return (
    <div className='rounded-[calc(var(--border-radius-md)-2px)] border border-(--border-subtle) bg-card px-5 py-4'>
      <div className='flex flex-col gap-3'>
        <div className='text-[11px] font-semibold uppercase tracking-[0.14em] text-(color:--text-secondary)'>Request example</div>
        <div className='no-bleed'>
          {children}
        </div>
      </div>
    </div>
  )
}

export function ResponseExample({ children, dropdown }: { children: React.ReactNode; dropdown?: boolean }) {
  return (
    <div className='rounded-[calc(var(--border-radius-md)-2px)] border border-(--border-subtle) bg-card px-5 py-4'>
      <div className='flex flex-col gap-3'>
        <div className='text-[11px] font-semibold uppercase tracking-[0.14em] text-(color:--text-secondary)'>Response example</div>
        <div className='no-bleed'>
          {children}
        </div>
      </div>
    </div>
  )
}

export function Tree({ children }: { children: React.ReactNode }) {
  return sectionCard(<div className='no-bleed flex flex-col gap-1 font-[var(--font-code)] text-sm'>{children}</div>)
}

export function TreeFolder({
  name,
  defaultOpen = false,
  openable = true,
  children,
}: {
  name: string
  defaultOpen?: boolean
  openable?: boolean
  children: React.ReactNode
}) {
  if (!openable) {
    return (
      <div className='ms-2 flex flex-col gap-1'>
        <div className='flex items-center gap-2 text-(color:--text-primary)'>
          <span aria-hidden='true'>•</span>
          <span>{name}/</span>
        </div>
        <div className='ms-4 flex flex-col gap-1'>{children}</div>
      </div>
    )
  }
  return (
    <details className='group ms-2 flex flex-col gap-1' open={defaultOpen}>
      <summary className='flex cursor-pointer list-none items-center gap-2 text-(color:--text-primary) [&::-webkit-details-marker]:hidden'>
        <span>{name}/</span>
        <Chevron />
      </summary>
      <div>
        <div className='ms-4 flex flex-col gap-1'>{children}</div>
      </div>
    </details>
  )
}

export function TreeFile({ name }: { name: string }) {
  return <div className='ms-2 text-(color:--text-secondary)'>{name}</div>
}

export function Color({ children }: { children: React.ReactNode }) {
  return <div className='flex flex-col gap-3'>{children}</div>
}

export function ColorRow({ title, children }: { title?: string; children: React.ReactNode }) {
  return sectionCard(
    <div className='flex flex-col gap-3'>
      {title && <div className='text-sm font-semibold text-(color:--text-primary)'>{title}</div>}
      <div className='flex flex-wrap gap-3'>{children}</div>
    </div>,
  )
}

export function ColorItem({
  name,
  value,
}: {
  name?: string
  value: string | { light?: string; dark?: string }
}) {
  const light = typeof value === 'string' ? value : value.light ?? value.dark ?? '#cccccc'
  const dark = typeof value === 'string' ? value : value.dark ?? value.light ?? '#666666'
  return (
    <div className='flex min-w-[120px] flex-col gap-2'>
      <div className='h-14 rounded-lg border border-(--border-subtle)' style={{ background: `linear-gradient(90deg, ${light} 0%, ${light} 50%, ${dark} 50%, ${dark} 100%)` }} />
      {name && <div className='text-xs font-medium text-(color:--text-primary)'>{name}</div>}
      <code className='inline-code text-[11px]'>{typeof value === 'string' ? value : `${light} / ${dark}`}</code>
    </div>
  )
}
