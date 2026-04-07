import React, { Children, isValidElement, useId, useMemo } from 'react'

type TabChildProps = {
  title?: string
  value?: string
  children?: React.ReactNode
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
}: {
  children: React.ReactNode
  items?: string[]
  defaultTabIndex?: number
}) {
  const tabs = useMemo(() => Children.toArray(children).filter(isTabElement), [children])
  const labels = items && items.length === tabs.length
    ? items
    : tabs.map((tab, index) => getTabTitle(tab, index))
  const maxIndex = Math.max(labels.length - 1, 0)
  const activeIndex = Math.min(defaultTabIndex, maxIndex)
  const groupName = useId().replace(/:/g, '')

  return (
    <div className='no-bleed overflow-hidden rounded-(--border-radius-md) border border-(--border-subtle) bg-card'>
      <div className='overflow-x-auto border-b border-(--border-subtle) bg-muted/40 p-2'>
        <div className='flex min-w-max flex-wrap gap-1'>
        {labels.map((label, index) => {
          const inputId = `${groupName}-${index}`
          return (
            <div key={`${label}-${index}`} className='contents'>
              <input
                id={inputId}
                data-tab-label={label}
                className='peer sr-only'
                type='radio'
                name={groupName}
                defaultChecked={index === activeIndex}
              />
              <label
                htmlFor={inputId}
                role='button'
                key={`${label}-${index}`}
                className='cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-(color:--text-secondary) transition-colors peer-checked:bg-background peer-checked:text-(color:--text-primary)'
              >
                {label}
              </label>
              <div className='order-last hidden w-full peer-checked:block' data-tab-panel={label}>
                {tabs[index]?.props.children}
              </div>
            </div>
          )
        })}
        </div>
      </div>
    </div>
  )
}

export function Tab({ children }: TabChildProps) {
  return <>{children}</>
}
