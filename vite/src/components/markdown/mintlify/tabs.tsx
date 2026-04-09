'use client'

import React, { Children, isValidElement, useMemo, useState } from 'react'
import { Icon } from '../../icon.tsx'

type TabChildProps = {
  title?: string
  value?: string
  /** Font Awesome styles and explicit library prefixes are forwarded to <Icon>. */
  icon?: string
  iconType?: string
  children?: React.ReactNode
}

type TabsProps = {
  children: React.ReactNode
  items?: string[]
  defaultTabIndex?: number
  sync?: boolean
  borderBottom?: boolean
}

type TabElement = React.ReactElement<TabChildProps>

function isTabElement(node: React.ReactNode): node is TabElement {
  return isValidElement(node)
}

function getTabTitle(node: TabElement, fallbackIndex: number) {
  return node.props.title ?? node.props.value ?? `Tab ${fallbackIndex + 1}`
}

export function Tabs({
  children,
  items,
  defaultTabIndex = 0,
  borderBottom = true,
}: TabsProps) {
  const tabs = useMemo(() => Children.toArray(children).filter(isTabElement), [children])
  const labels = items && items.length === tabs.length ? items : tabs.map((tab, index) => getTabTitle(tab, index))
  const maxIndex = Math.max(labels.length - 1, 0)
  const initialIndex = Math.min(defaultTabIndex, maxIndex)
  const [activeIndex, setActiveIndex] = useState(initialIndex)
  const activeTab = tabs[activeIndex]

  return (
    <div className='no-bleed overflow-hidden rounded-(--border-radius-md) border border-(--border-subtle) bg-card'>
      <div className={`${borderBottom ? 'border-b border-(--border-subtle)' : ''} overflow-x-auto bg-muted/40 p-2`}>
        <div role='tablist' className='flex min-w-max gap-1'>
          {labels.map((label, index) => {
            const active = index === activeIndex
            const tabIcon = tabs[index]?.props.icon
            const tabIconType = tabs[index]?.props.iconType
            return (
              <button
                key={`${label}-${index}`}
                type='button'
                role='tab'
                aria-selected={active}
                onClick={() => setActiveIndex(index)}
                className='cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors'
                style={{
                  backgroundColor: active ? 'var(--background)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
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
      <div role='tabpanel' className='p-3'>
        {activeTab?.props.children}
      </div>
    </div>
  )
}

export function Tab({ children }: TabChildProps) {
  return <>{children}</>
}
