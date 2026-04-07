'use client'

/**
 * Minimal Mintlify compatibility components.
 *
 * These prioritize safe rendering and fixture coverage over exact visual parity.
 */

import React from 'react'
import { Icon as SiteIcon } from '../../icon.tsx'
import { useMintlifyState } from './state.tsx'

function Chevron() {
  return (
    <span className='ml-auto flex shrink-0 items-center text-(color:--text-secondary)'>
      <svg className='block h-4 w-4 group-open:hidden' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
        <path d='M6 4.5 9.5 8 6 11.5' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
      <svg className='hidden h-4 w-4 group-open:block' viewBox='0 0 16 16' fill='none' aria-hidden='true'>
        <path d='M4.5 6 8 9.5 11.5 6' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
      </svg>
    </span>
  )
}

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
}: {
  children: React.ReactNode
  color?: string
}) {
  const colors: Record<string, { bg: string; fg: string; border: string }> = {
    gray: { bg: 'rgba(0,0,0,0.05)', fg: 'var(--text-primary)', border: 'var(--border-subtle)' },
    blue: { bg: 'rgba(59,130,246,0.12)', fg: 'rgb(29 78 216)', border: 'rgba(59,130,246,0.18)' },
    green: { bg: 'rgba(16,185,129,0.12)', fg: 'rgb(4 120 87)', border: 'rgba(16,185,129,0.18)' },
    yellow: { bg: 'rgba(245,158,11,0.14)', fg: 'rgb(180 83 9)', border: 'rgba(245,158,11,0.2)' },
    orange: { bg: 'rgba(249,115,22,0.14)', fg: 'rgb(194 65 12)', border: 'rgba(249,115,22,0.2)' },
    red: { bg: 'rgba(239,68,68,0.12)', fg: 'rgb(185 28 28)', border: 'rgba(239,68,68,0.18)' },
    purple: { bg: 'rgba(168,85,247,0.12)', fg: 'rgb(126 34 206)', border: 'rgba(168,85,247,0.18)' },
    white: { bg: 'rgba(255,255,255,0.85)', fg: 'rgb(17 17 17)', border: 'rgba(0,0,0,0.08)' },
    surface: { bg: 'var(--muted)', fg: 'var(--text-primary)', border: 'var(--border-subtle)' },
  }
  const tone = colors[color] ?? colors.gray ?? { bg: 'rgba(0,0,0,0.05)', fg: 'var(--text-primary)', border: 'var(--border-subtle)' }
  return (
    <span
      className='inline-flex w-fit self-start items-center rounded-full border px-2 py-0.5 text-[11px] font-medium'
      style={{ backgroundColor: tone.bg, color: tone.fg, borderColor: tone.border }}
    >
      {children}
    </span>
  )
}

export function Card({
  title,
  icon,
  href,
  children,
}: {
  title?: string
  icon?: string
  href?: string
  children?: React.ReactNode
}) {
  const content = (
    <div className='flex h-full flex-col gap-2 rounded-(--border-radius-md) border border-(--border-subtle) bg-card p-4'>
      <div className='flex items-center gap-2'>
        <SiteIcon icon={icon} size={16} />
        {title && <div className='text-sm font-semibold text-(color:--text-primary)'>{title}</div>}
      </div>
      {children && <div className='flex flex-col gap-3 text-sm text-(color:--text-secondary)'>{children}</div>}
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

export function Column({ children }: { children: React.ReactNode }) {
  return <div className='min-w-0'>{children}</div>
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

export function Prompt({ description, children }: { description: string; children: React.ReactNode }) {
  const plainText = typeof children === 'string' || typeof children === 'number'
  return sectionCard(
    <div className='flex flex-col gap-3'>
      <div className='text-xs font-semibold uppercase tracking-wide text-(color:--text-secondary)'>{description}</div>
      <div
        className={plainText
          ? 'rounded-lg bg-muted/50 p-3 text-sm text-(color:--text-primary) [font-family:var(--font-code)] whitespace-pre-wrap'
          : 'flex flex-col gap-3 rounded-lg bg-muted/30 p-3 text-sm text-(color:--text-primary)'}
      >
        {children}
      </div>
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
      {children && <div className='flex flex-col gap-3 text-(color:--text-secondary)'>{children}</div>}
    </div>,
  )
}

export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className='m-0 flex list-decimal flex-col gap-4 ps-5'>{children}</ol>
}

export function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className='ps-1'>
      <div className='flex flex-col gap-2'>
        <div className='text-sm font-semibold text-(color:--text-primary)'>{title}</div>
        <div className='text-sm text-(color:--text-secondary)'>{children}</div>
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

export function Tooltip({ tip, children }: { tip: string; children: React.ReactNode }) {
  return <span title={tip} className='cursor-help underline decoration-dotted'>{children}</span>
}

export function Update({
  label,
  description,
  tags,
  children,
}: {
  label: string
  description?: string
  tags?: string[]
  children: React.ReactNode
}) {
  return sectionCard(
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='text-sm font-semibold text-(color:--text-primary)'>{label}</div>
        {description && <div className='text-xs text-(color:--text-secondary)'>{description}</div>}
        {tags?.map((tag) => <Badge key={tag} color='blue'>{tag}</Badge>)}
      </div>
      <div className='flex flex-col gap-3 text-sm text-(color:--text-secondary)'>{children}</div>
    </div>,
  )
}

export function View({ title, icon, children }: { title: string; icon?: string; children: React.ReactNode }) {
  const state = useMintlifyState()
  const active = state?.activeView === title
  return sectionCard(
    <div className='flex flex-col gap-3'>
      <button
        type='button'
        onClick={() => state?.setActiveView(active ? null : title)}
        className='flex items-center gap-2 text-left text-sm font-semibold text-(color:--text-primary)'
      >
        <SiteIcon icon={icon} size={16} />
        <span>{title}</span>
        <Chevron />
      </button>
      {active ? <div className='flex flex-col gap-3 text-sm text-(color:--text-secondary)'>{children}</div> : null}
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

export function RequestExample({ children }: { children: React.ReactNode }) {
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

export function ResponseExample({ children }: { children: React.ReactNode }) {
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
  return <div className='ms-2 text-(color:--text-tree-label)'>{name}</div>
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

export function MintlifyIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  return <SiteIcon icon={icon} size={size} />
}
