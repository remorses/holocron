'use client'

import React, { Children, isValidElement, useId, useMemo, useRef, useState } from 'react'
import { cn } from '../../../lib/css-vars.ts'
import { Icon } from '../../icon.tsx'

type TabChildProps = {
  id?: string
  title?: string
  value?: string
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
  onTabChange?: (tabIndex: number) => void
}

export function Tabs({
  children,
  items,
  defaultTabIndex = 0,
  borderBottom = true,
  className = '',
  ariaLabel = 'Tabs',
  onTabChange,
}: TabsProps) {
  const tabs = useMemo(() => {
    return Children.toArray(children).filter((node): node is React.ReactElement<TabChildProps> => isValidElement(node))
  }, [children])
  const labels = items && items.length === tabs.length
    ? items
    : tabs.map((tab, index) => tab.props.title ?? tab.props.value ?? `Tab ${index + 1}`)
  const maxIndex = Math.max(labels.length - 1, 0)
  const initialIndex = Math.min(defaultTabIndex, maxIndex)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const activeTab = tabs[activeIndex]
  const uniqueId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
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

  return (
    <div className={cn('rounded-2xl bg-accent px-0.5 pb-0.5 pt-px', className)}>
      <div className='overflow-x-auto px-2.5 py-1'>
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
                className='cursor-pointer py-1 text-xs font-medium transition-colors'
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
      <div
        id={`${tabIds[activeIndex]}-panel`}
        role='tabpanel'
        aria-labelledby={tabIds[activeIndex]}
        tabIndex={0}
        className='no-bleed flex flex-col gap-(--prose-gap) rounded-[15px] bg-background p-4'
      >
        {activeTab?.props.children}
      </div>
    </div>
  )
}

export function Tab({ children }: TabChildProps) {
  return <>{children}</>
}
