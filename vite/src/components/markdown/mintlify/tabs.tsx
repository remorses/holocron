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
    <div className='rounded-2xl bg-accent px-0.5 pb-0.5 pt-px'>
      <div className='overflow-x-auto px-2.5 py-1'>
        <div role='tablist' className='flex min-w-max gap-3'>
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
      <div role='tabpanel' className='no-bleed flex flex-col gap-(--prose-gap) rounded-[15px] bg-background p-4'>
        {activeTab?.props.children}
      </div>
    </div>
  )
}

export function Tab({ children }: TabChildProps) {
  return <>{children}</>
}
