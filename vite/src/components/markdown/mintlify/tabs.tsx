'use client'

import React, { Children, isValidElement, useId, useMemo, useState } from 'react'
import { useMintlifyState } from './state.tsx'

type TabChildProps = {
  title?: string
  value?: string
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
  sync = true,
  borderBottom = true,
}: TabsProps) {
  const tabs = useMemo(() => Children.toArray(children).filter(isTabElement), [children])
  const labels = items && items.length === tabs.length ? items : tabs.map((tab, index) => getTabTitle(tab, index))
  const maxIndex = Math.max(labels.length - 1, 0)
  const fallbackIndex = Math.min(defaultTabIndex, maxIndex)
  const fallbackLabel = labels[fallbackIndex] ?? labels[0] ?? ''
  const [localLabel, setLocalLabel] = useState(fallbackLabel)
  const state = useMintlifyState()
  const groupId = useId()
  const groupKey = `tabs:${labels.join('|') || groupId}`
  const activeLabel = sync ? (state?.tabs[groupKey] ?? fallbackLabel) : localLabel
  const activeIndex = Math.max(labels.indexOf(activeLabel), 0)
  const activeTab = tabs[activeIndex]

  function setActive(label: string) {
    if (sync && state) {
      state.setTab(groupKey, label)
      return
    }
    setLocalLabel(label)
  }

  return (
    <div className='no-bleed overflow-hidden rounded-(--border-radius-md) border border-(--border-subtle) bg-card'>
      <div className={`${borderBottom ? 'border-b border-(--border-subtle)' : ''} overflow-x-auto bg-muted/40 p-2`}>
        <div role='tablist' className='flex min-w-max gap-1'>
          {labels.map((label, index) => {
            const active = index === activeIndex
            return (
              <button
                key={`${label}-${index}`}
                type='button'
                role='tab'
                aria-selected={active}
                onClick={() => setActive(label)}
                className='cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors'
                style={{
                  backgroundColor: active ? 'var(--background)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>
      <div role='tabpanel' className='p-0'>
        {activeTab?.props.children}
      </div>
    </div>
  )
}

export function Tab({ children }: TabChildProps) {
  return <>{children}</>
}
