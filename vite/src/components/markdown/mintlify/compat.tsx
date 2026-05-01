'use client'

/**
 * Minimal Mintlify compatibility components.
 *
 * These prioritize safe rendering and fixture coverage over exact visual parity.
 * All icon rendering goes through the shared <Icon> component which handles
 * emoji, URL, and atlas-based icons with iconType/color dispatch.
 */

import React from 'react'
import { Link } from 'spiceflow/react'
import { Icon } from '../../icon.tsx'
import { Chevron } from './chevron.tsx'
import { slugify } from '../../../lib/toc-tree.ts'

function isExternalHref(href: string | undefined) {
  return href?.startsWith('http://') || href?.startsWith('https://')
}

function renderCompatIcon({
  icon,
  iconType,
  size = 16,
  color,
}: {
  icon: React.ReactNode | string | undefined
  iconType?: string
  size?: number
  color?: string
}) {
  if (!icon) return null
  if (typeof icon === 'string') return <Icon icon={icon} iconType={iconType} size={size} color={color} />
  return icon
}

function sectionCard(children: React.ReactNode, className = '') {
  return (
    <div className={`no-bleed flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4 ${className}`.trim()}>
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
  leadIcon,
  tailIcon,
  iconType,
  iconLibrary: _iconLibrary,
  size,
  shape = 'rounded',
  stroke,
  variant,
  disabled,
  href,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  color?: string
  icon?: React.ReactNode | string
  leadIcon?: React.ReactNode | string
  tailIcon?: React.ReactNode | string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  iconLibrary?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  shape?: 'rounded' | 'pill'
  variant?: 'solid' | 'outline'
  stroke?: boolean
  disabled?: boolean
  href?: string
  onClick?: () => void
  className?: string
}) {
  const sizeClass = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]'
    : size === 'sm' ? 'px-2 py-0.5 text-[11px]'
    : size === 'lg' ? 'px-3 py-1 text-[13px]'
    : 'px-2 py-0.5 text-[11px]'
  const shapeClass = shape === 'pill' ? 'rounded-full' : 'rounded-md'
  const outline = variant === 'outline' || stroke
  const iconSize = size === 'xs' ? 10 : size === 'lg' ? 14 : 12
  const leading = renderCompatIcon({ icon: leadIcon, iconType, size: iconSize })
  const trailing = renderCompatIcon({ icon: tailIcon ?? icon, iconType, size: iconSize })

  const renderBadge = (variantClass: string, iconColor?: string) => {
    const badgeClass = `inline-flex w-fit self-start items-center gap-1 border ${sizeClass} ${shapeClass} ${variantClass} ${disabled ? 'opacity-50' : ''} ${(href || onClick) && !disabled ? 'cursor-pointer transition-opacity hover:opacity-80' : ''} ${className}`.trim()
    const content = <>{leading}{children}{trailing || (iconColor && icon ? <Icon icon={String(icon)} iconType={iconType} size={iconSize} color={iconColor} /> : null)}</>
    if (href && !disabled) {
      const external = isExternalHref(href)
      return <a className={badgeClass} href={href} onClick={onClick} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{content}</a>
    }
    if (onClick && !disabled) {
      return <button type='button' className={badgeClass} onClick={onClick}>{content}</button>
    }
    return <span className={badgeClass}>{content}</span>
  }

  if (color === 'gray' || color === 'surface') {
    return renderBadge('bg-muted text-foreground border-border-subtle')
  }
  if (color === 'white') {
    return renderBadge('bg-white/85 text-neutral-900 dark:text-neutral-100 border-black/8')
  }
  const destructive = color === 'white-destructive' || color === 'surface-destructive'
  if (destructive) {
    return renderBadge('bg-red/10 text-red border-red/20', 'var(--red)')
  }
  const cls: Record<string, string> = {
    blue: outline ? 'text-blue border-blue' : 'bg-blue/10 text-blue border-blue/20',
    green: outline ? 'text-green border-green' : 'bg-green/10 text-green border-green/20',
    yellow: outline ? 'text-yellow border-yellow' : 'bg-yellow/10 text-yellow border-yellow/20',
    orange: outline ? 'text-orange border-orange' : 'bg-orange/10 text-orange border-orange/20',
    red: outline ? 'text-red border-red' : 'bg-red/10 text-red border-red/20',
    purple: outline ? 'text-purple border-purple' : 'bg-purple/10 text-purple border-purple/20',
  }
  const variantCls = cls[color] ?? cls.blue!
  return renderBadge(variantCls)
}

export function Card({
  title,
  icon,
  iconType,
  iconLibrary: _iconLibrary,
  color,
  href,
  horizontal,
  img,
  cta,
  arrow,
  disabled,
  as,
  className = '',
  children,
}: {
  title?: React.ReactNode
  icon?: React.ReactNode | string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  iconType?: string
  iconLibrary?: string
  color?: string
  href?: string
  horizontal?: boolean
  img?: string
  cta?: string
  arrow?: boolean
  disabled?: boolean
  as?: React.ElementType
  className?: string
  children?: React.ReactNode
}) {
  const external = isExternalHref(href)
  const showArrow = arrow ?? external
  const content = (
    <div className={`group/card relative flex h-full flex-col gap-2 rounded-lg border border-border-subtle bg-card p-4 ${horizontal ? 'flex-row items-center' : ''} ${disabled ? 'opacity-50' : ''} ${className}`.trim()}>
      {img && <img src={img} alt='' className='w-full rounded-lg border border-border-subtle' />}
      <div className='flex items-center gap-2'>
        {renderCompatIcon({ icon, iconType, size: 16, color })}
        {title ? <div className='text-sm font-semibold text-foreground'>{title}</div> : null}
      </div>
      {children !== undefined && children !== null && <div className='flex flex-col gap-3 text-sm text-muted-foreground'>{children}</div>}
      {(cta || showArrow) && <div className='flex items-center gap-1 text-xs text-primary'>{cta}{showArrow && <span aria-hidden='true'>↗</span>}</div>}
    </div>
  )
  if (disabled || !href) {
    if (!as) return content
    const Component = as
    return <Component>{content}</Component>
  }
  if (external) return <a href={href} target='_blank' rel='noreferrer' className='no-underline'>{content}</a>
  return <Link href={href} className='no-underline'>{content}</Link>
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
  description,
  icon,
  iconType,
  iconLibrary: _iconLibrary,
  defaultOpen = false,
  className = '',
  children,
}: {
  title?: React.ReactNode
  description?: string
  icon?: React.ReactNode | string
  iconType?: string
  iconLibrary?: string
  defaultOpen?: boolean | string
  className?: string
  children: React.ReactNode
}) {
  const open = defaultOpen === true || defaultOpen === 'true'
  return (
    <details className={`no-bleed group rounded-lg border border-border-subtle bg-card ${className}`.trim()} open={open}>
      <summary className='flex cursor-pointer select-none list-none items-center gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden'>
        {renderCompatIcon({ icon, iconType, size: 16 })}
        <span className='flex min-w-0 flex-col gap-1'>
          <span className='font-semibold text-foreground'>{title}</span>
          {description && <span className='text-xs font-normal text-muted-foreground'>{description}</span>}
        </span>
        <Chevron />
      </summary>
      <div className='no-bleed flex flex-col gap-3 px-4 pb-4 text-sm text-muted-foreground'>{children}</div>
    </details>
  )
}

export function Frame({
  as: Component = 'div',
  title,
  description,
  caption,
  hint,
  style,
  className = '',
  children,
}: {
  as?: React.ElementType
  title?: string
  description?: string
  caption?: string
  hint?: string
  style?: React.CSSProperties
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className} data-component-part='frame-container'>
      {title && (
        <div className='not-prose flex items-center gap-2 pb-4'>
          <svg
            aria-hidden='true'
            className='size-4 flex-none fill-current text-muted-foreground'
            viewBox='0 0 512 512'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path d='M224 320c0 17.69 14.33 32 32 32h64c17.67 0 32-14.31 32-32s-14.33-32-32-32h-64C238.3 288 224 302.3 224 320zM267.6 256H352c17.67 0 32-14.31 32-32s-14.33-32-32-32h-80v40C272 240.5 270.3 248.5 267.6 256zM272 160H480c17.67 0 32-14.31 32-32s-14.33-32-32-32h-208.8C271.5 98.66 272 101.3 272 104V160zM320 416c0-17.69-14.33-32-32-32H224c-17.67 0-32 14.31-32 32s14.33 32 32 32h64C305.7 448 320 433.7 320 416zM202.1 355.8C196 345.6 192 333.3 192 320c0-5.766 1.08-11.24 2.51-16.55C157.4 300.6 128 269.9 128 232V159.1C128 151.2 135.2 144 143.1 144S160 151.2 159.1 159.1l0 69.72C159.1 245.2 171.3 271.1 200 271.1C222.1 271.1 240 254.1 240 232v-128C240 81.91 222.1 64 200 64H136.6C103.5 64 72.03 80 52.47 106.8L26.02 143.2C9.107 166.5 0 194.5 0 223.3V312C0 387.1 60.89 448 136 448h32.88C163.4 438.6 160 427.7 160 416C160 388.1 178 364.6 202.1 355.8z' />
          </svg>
          <div className='font-medium text-sm text-foreground'>{title}</div>
        </div>
      )}
      <Component
        className='not-prose relative overflow-hidden rounded-2xl bg-muted/30 p-2'
        data-component-part='frame'
        data-name='frame'
        style={style}
      >
        <div
          aria-hidden='true'
          className='absolute inset-0 opacity-50'
          data-component-part='frame-background-pattern'
          style={{
            backgroundImage: 'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            backgroundPosition: '10px 10px',
          }}
        />
        <div
          className='relative flex w-full justify-center overflow-hidden rounded-xl bg-background'
          data-component-part='frame-content'
        >
          {children}
        </div>

        {(description || caption || hint) && (
          <div
            className='relative flex w-full justify-center rounded-2xl bg-background px-8 pb-2 pt-3 text-sm text-muted-foreground'
            contentEditable={false}
            data-component-part='frame-description'
          >
            {description ?? caption ?? hint}
          </div>
        )}
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 rounded-2xl border border-border-subtle'
          data-component-part='frame-border'
        />
      </Component>
    </div>
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
        <div className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>{description}</div>
      </div>
      <div
        className={plainText
          ? 'rounded-lg bg-muted/50 p-3 text-sm text-foreground [font-family:var(--font-code)] whitespace-pre-wrap'
          : 'flex flex-col gap-3 rounded-lg bg-muted/30 p-3 text-sm text-foreground'}
      >
        {children}
      </div>
      {showCopy && (
        <button
          type='button'
          className='self-end rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors'
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
      <div className='flex flex-col gap-3 text-muted-foreground'>{props.children}</div>
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
      {children !== undefined && children !== null && <div className='flex flex-col gap-3 text-muted-foreground'>{children}</div>}
    </div>,
  )
}

export function Steps({ children, titleSize = 'p' }: { children: React.ReactNode; titleSize?: 'p' | 'h2' | 'h3' | 'h4' }) {
  return <ol className='no-bleed m-0 flex list-none flex-col gap-(--prose-gap) ps-0 [counter-reset:step]'>{children}</ol>
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
    <li className='relative flex gap-3 [counter-increment:step]'>
      {/* Left column: circle + vertical line */}
      <div className='relative flex flex-col items-center'>
        <div className='flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-xs font-semibold text-foreground [&::before]:content-[counter(step)]' />
        {/* Connecting line — hidden on last step via CSS */}
        <div className='mt-1.5 w-px flex-1 bg-border [li:last-child_&]:hidden' />
      </div>
      {/* Right column: title + content */}
      <div className='flex min-w-0 flex-1 flex-col gap-(--prose-gap) pb-2'>
        <div className='flex items-center gap-2 pt-1 text-sm font-semibold text-foreground'>
          {icon && <Icon icon={icon} iconType={iconType} size={16} />}
          {title}
        </div>
        <div className='no-bleed flex flex-col gap-(--prose-gap) text-sm text-muted-foreground'>{children}</div>
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
    <Link href={href} className='no-underline'>
      <div className='flex h-full flex-col gap-3 rounded-lg border border-border-subtle bg-card p-3'>
        <div className='overflow-hidden rounded-lg border border-border-subtle bg-muted/40 p-2'>{children}</div>
        {title && <div className='text-sm font-semibold text-foreground'>{title}</div>}
        {description && <div className='text-xs text-muted-foreground'>{description}</div>}
      </div>
    </Link>
  )
}

export function Tooltip({
  tip,
  description,
  headline,
  title,
  cta,
  href,
  side: _side,
  align: _align,
  className = '',
  children,
}: {
  tip?: string
  description?: string
  headline?: string
  title?: string
  cta?: string
  href?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
  className?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  const resolvedTitle = title ?? headline
  const resolvedDescription = description ?? tip
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
      className={`relative inline-flex w-fit cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2 ${className}`.trim()}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {trigger}
      {open && (
        <span
          className='absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border-subtle bg-card px-3 py-2 text-sm text-foreground shadow-lg'
          role='tooltip'
        >
          {resolvedTitle && <div className='text-xs font-semibold'>{resolvedTitle}</div>}
          {resolvedDescription && <div>{resolvedDescription}</div>}
          {cta && href && (
            <Link href={href} className='inline-block text-xs text-primary hover:underline'>{cta}</Link>
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

export function View({ title, icon, iconType, children }: { title: string; icon?: string; /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */ iconType?: string; children: React.ReactNode }) {
  return sectionCard(
    <div className='flex flex-col gap-3'>
      <div className='flex items-center gap-2 text-sm font-semibold text-foreground'>
        {icon && <Icon icon={icon} iconType={iconType} size={16} />}
        <span>{title}</span>
      </div>
      <div className='flex flex-col gap-3 text-sm text-muted-foreground'>{children}</div>
    </div>,
  )
}

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className='rounded-lg border border-border-subtle bg-muted/20 p-4'>
      <div className='no-bleed flex flex-col gap-y-4 text-sm text-muted-foreground'>
        {children}
      </div>
    </div>
  )
}

function CopyIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <rect x='9' y='9' width='13' height='13' rx='2' ry='2' />
      <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
      <polyline points='20 6 9 17 4 12' />
    </svg>
  )
}

/**
 * CodeCard — Mintlify-style rounded code container with optional title and
 * copy button. Used by RequestExample, ResponseExample, and available as a
 * standalone MDX component.
 *
 * ## Tinted shell container pattern (flagship design pattern)
 *
 * The primary visual pattern for interactive and code-related components
 * is a tinted outer shell wrapping a card-colored inner body. This creates
 * a subtle two-tier depth effect that works in both light and dark mode
 * without hardcoded colors.
 *
 * Structure: outer tinted shell → optional header content → inner card surface.
 *
 *   ┌─ outer shell: bg-accent, rounded-2xl ─────────────┐
 *   │  px-0.5  pb-0.5  pt-px  (1-2px padding on all sides)    │
 *   │                                                          │
 *   │  ┌─ header area (sits in the tinted shell) ────────────┐ │
 *   │  │  px-3 py-1.5                                        │ │
 *   │  │  Title text          [copy button]                  │ │
 *   │  └─────────────────────────────────────────────────────┘ │
 *   │  ┌─ inner body: bg-background, rounded-[15px] ─────────┐ │
 *   │  │  px-4 py-3.5                                        │ │
 *   │  │  Content (code, form, chat input, etc.)             │ │
 *   │  └─────────────────────────────────────────────────────┘ │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Why it works: bg-accent uses the foreground color at 8% opacity,
 * so it auto-adapts to both light mode (light gray tint on white) and dark
 * mode (faint white tint on dark). The inner bg-background card sits inset
 * with rounded corners, creating a layered feel. The 0.5 (2px) padding
 * between shell and body makes the tint visible as a thin border-like frame.
 *
 * Also used by: SidebarAssistant (AI chat widget), ChatDrawer footer,
 * Tabs (similar two-tier with bg-muted/40 header). Use this pattern for
 * any new component that wraps interactive or code content.
 */
export function CodeCard({
  title,
  children,
  copyable = true,
}: {
  title?: string
  children: React.ReactNode
  copyable?: boolean
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const [copied, setCopied] = React.useState(false)

  const handleCopy = () => {
    const text = contentRef.current?.textContent ?? ''
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className='rounded-2xl bg-accent px-0.5 pb-0.5 pt-px'>
      {/* Header bar: title left, copy button right — sits in the tinted shell */}
      {(title || copyable) && (
        <div className='flex items-center justify-between gap-2 px-3 py-1.5'>
          {title
            ? <span className='truncate text-xs font-medium text-muted-foreground'>{title}</span>
            : <span />}
          {copyable && (
            <button
              type='button'
              onClick={handleCopy}
              aria-label='Copy code'
              className='flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground'
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}
        </div>
      )}
      {/* Inner card body — bg-background gives the white/dark code surface */}
      <div
        ref={contentRef}
        className='no-bleed overflow-x-auto rounded-[15px] bg-background px-4 py-3.5'
      >
        {children}
      </div>
    </div>
  )
}

export function RequestExample({ children, dropdown }: { children: React.ReactNode; dropdown?: boolean }) {
  return <CodeCard title='Request example'>{children}</CodeCard>
}

export function ResponseExample({ children, dropdown }: { children: React.ReactNode; dropdown?: boolean }) {
  return <CodeCard title='Response example'>{children}</CodeCard>
}

export function Tree({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return sectionCard(<div className={`no-bleed flex flex-col gap-1 font-[var(--font-code)] text-sm ${className}`.trim()}>{children}</div>)
}

export function TreeFolder({
  name,
  icon,
  iconType,
  defaultOpen = false,
  openable = true,
  className = '',
  children,
}: {
  name: string
  icon?: React.ReactNode | string
  iconType?: string
  defaultOpen?: boolean | string
  openable?: boolean
  className?: string
  children: React.ReactNode
}) {
  const open = defaultOpen === true || defaultOpen === 'true'
  if (!openable) {
    return (
      <div className={`ms-2 flex flex-col gap-1 ${className}`.trim()}>
        <div className='flex items-center gap-2 text-foreground'>
          {renderCompatIcon({ icon, iconType, size: 14 }) ?? <span aria-hidden='true'>•</span>}
          <span>{name}/</span>
        </div>
        <div className='ms-4 flex flex-col gap-1'>{children}</div>
      </div>
    )
  }
  return (
    <details className={`group ms-2 flex flex-col gap-1 ${className}`.trim()} open={open}>
      <summary className='flex cursor-pointer select-none list-none items-center gap-2 text-foreground [&::-webkit-details-marker]:hidden'>
        {renderCompatIcon({ icon, iconType, size: 14 })}
        <span>{name}/</span>
        <Chevron />
      </summary>
      <div>
        <div className='ms-4 flex flex-col gap-1'>{children}</div>
      </div>
    </details>
  )
}

export function TreeFile({ name, icon, iconType, className = '' }: { name: string; icon?: React.ReactNode | string; iconType?: string; className?: string }) {
  return <div className={`ms-2 flex items-center gap-2 text-muted-foreground ${className}`.trim()}>{renderCompatIcon({ icon, iconType, size: 14 })}<span>{name}</span></div>
}

export function Color({ children }: { children: React.ReactNode }) {
  return <div className='flex flex-col gap-3'>{children}</div>
}

export function ColorRow({ title, children }: { title?: string; children: React.ReactNode }) {
  return sectionCard(
    <div className='flex flex-col gap-3'>
      {title && <div className='text-sm font-semibold text-foreground'>{title}</div>}
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
      <div className='h-14 rounded-lg border border-border-subtle' style={{ background: `linear-gradient(90deg, ${light} 0%, ${light} 50%, ${dark} 50%, ${dark} 100%)` }} />
      {name && <div className='text-xs font-medium text-foreground'>{name}</div>}
      <code className='inline-code text-[11px]'>{typeof value === 'string' ? value : `${light} / ${dark}`}</code>
    </div>
  )
}

/**
 * Conditional content visibility for humans vs AI agents.
 *
 * On the web page: `for="humans"` (or no `for`) renders children normally,
 * `for="agents"` renders nothing. The `.md` route does the inverse via
 * `stripVisibilityForAgents()` in raw-markdown.ts.
 */
export function Visibility({ for: audience, children }: { for?: 'humans' | 'agents'; children?: React.ReactNode }) {
  if (audience === 'agents') return null
  return <>{children}</>
}
