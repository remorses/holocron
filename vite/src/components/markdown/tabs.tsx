'use client'

import React, { Children, isValidElement, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/css-vars.ts'
import { Icon } from '../icon.tsx'

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

type TabChildProps = {
  id?: string
  title?: string
  value?: string
  /** A `<CodeBlock>` child carries `lang` — used as a fallback tab label. */
  lang?: string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  icon?: string
  iconType?: string
  iconLibrary?: string
  children?: React.ReactNode
}

type TabsProps = {
  children: React.ReactNode
  items?: string[]
  defaultTabIndex?: number
  sync?: boolean
  borderBottom?: boolean
  dropdown?: boolean
  className?: string
  ariaLabel?: string
  /** Optional label shown on the left of the tab bar (e.g. "Request example"). */
  title?: string
  /** Show a persistent copy button that copies the active panel's text. */
  copyable?: boolean
  onTabChange?: (tabIndex: number) => void
}

export function Tabs({
  children,
  items,
  defaultTabIndex = 0,
  borderBottom = true,
  className = '',
  ariaLabel = 'Tabs',
  title,
  copyable = false,
  onTabChange,
}: TabsProps) {
  const tabs = useMemo(() => {
    return Children.toArray(children).filter((node): node is React.ReactElement<TabChildProps> => isValidElement(node))
  }, [children])
  const labels = items && items.length === tabs.length
    ? items
    : tabs.map((tab, index) => tab.props.title ?? tab.props.value ?? tab.props.lang ?? `Tab ${index + 1}`)
  const maxIndex = Math.max(labels.length - 1, 0)
  const initialIndex = Math.min(defaultTabIndex, maxIndex)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const activeTab = tabs[activeIndex]
  const uniqueId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const tabIds = tabs.map((tab, index) => tab.props.id ?? `${uniqueId}-tab-${index}`)

  const selectTab = (index: number) => {
    if (index === activeIndex) return
    setActiveIndex(index)
    onTabChange?.(index)
  }

  const focusTab = (index: number) => {
    selectTab(index)
    tabRefs.current[index]?.focus()
  }

  const handleCopy = () => {
    const text = panelRef.current?.textContent ?? ''
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => { /* clipboard write failed (insecure context, denied permission) */ },
    )
  }

  return (
    <div className={cn('rounded-2xl bg-accent px-0.5 pb-0.5 pt-px', className)}>
      <div className='flex items-center gap-2 pr-1'>
        {title && (
          <span className='shrink-0 truncate pl-3 text-xs font-medium text-muted-foreground'>{title}</span>
        )}
        <div className='min-w-0 flex-1 overflow-x-auto scrollbar-none px-2.5 py-1'>
          <div role='tablist' aria-label={ariaLabel} className='flex min-w-max gap-3'>
          {labels.map((label, index) => {
            const active = index === activeIndex
            const tabIcon = tabs[index]?.props.icon
            const tabIconType = tabs[index]?.props.iconType
            const tabId = tabIds[index]!
            const panelId = `${tabId}-panel`
            return (
              <button
                key={tabId}
                ref={(el) => { tabRefs.current[index] = el }}
                type='button'
                id={tabId}
                role='tab'
                aria-selected={active}
                aria-controls={panelId}
                tabIndex={active ? 0 : -1}
                onClick={() => selectTab(index)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    focusTab((index - 1 + labels.length) % labels.length)
                  } else if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    focusTab((index + 1) % labels.length)
                  } else if (event.key === 'Home') {
                    event.preventDefault()
                    focusTab(0)
                  } else if (event.key === 'End') {
                    event.preventDefault()
                    focusTab(labels.length - 1)
                  } else if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    selectTab(index)
                  }
                }}
                className='cursor-pointer select-none py-1 text-xs font-medium transition-colors [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none'
                style={{
                  color: active ? 'var(--primary)' : 'var(--muted-foreground)',
                }}
              >
                <span className='inline-flex items-center gap-1.5'>
                  {tabIcon && <Icon icon={tabIcon} iconType={tabIconType} size={12} />}
                  {label}
                </span>
              </button>
            )
          })}
          </div>
        </div>
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
      <div
        ref={panelRef}
        id={`${tabIds[activeIndex]}-panel`}
        role='tabpanel'
        aria-labelledby={tabIds[activeIndex]}
        tabIndex={0}
        className='no-bleed flex flex-col gap-(--prose-gap) rounded-xl bg-background p-4'
      >
        {/* `<Tab>` children render their inner content; any other element
            (e.g. a `<CodeBlock>` passed directly by RequestExample) renders
            the element itself so highlighting and props are preserved. */}
        {activeTab?.type === Tab ? activeTab.props.children : activeTab}
      </div>
    </div>
  )
}

export function Tab({ children }: TabChildProps) {
  return <>{children}</>
}
