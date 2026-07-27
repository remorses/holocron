'use client'

import React, {
  Children,
  isValidElement,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { cn } from '../../lib/css-vars.ts'
import { Icon } from '../icon.tsx'

/* ── Tab title sync (Mintlify-compatible) ───────────────────────────────
 * When sync is on, selecting a tab publishes its title. Other synced Tabs
 * that have a matching title switch to it. Preference is kept in memory +
 * localStorage so it survives navigation. useSyncExternalStore keeps SSR
 * and the first client paint on defaultTabIndex, then applies the stored
 * title after hydration (no useEffect flash pattern).
 */

const TAB_SYNC_STORAGE_KEY = 'holocron-tab-sync'

const tabSyncListeners = new Set<() => void>()
/** undefined = not yet read from localStorage on this client. */
let tabSyncMemory: string | null | undefined

function readTabSyncStorage(): string | null {
  try {
    return localStorage.getItem(TAB_SYNC_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Client snapshot — stable module fn for useSyncExternalStore. */
export function getSyncedTabTitle(): string | null {
  if (tabSyncMemory === undefined) {
    tabSyncMemory = typeof localStorage !== 'undefined' ? readTabSyncStorage() : null
  }
  return tabSyncMemory ?? null
}

/** Server + first-paint snapshot — always no preference. */
export function getServerSyncedTabTitle(): string | null {
  return null
}

export function subscribeSyncedTabTitle(cb: () => void): () => void {
  tabSyncListeners.add(cb)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== TAB_SYNC_STORAGE_KEY) return
    tabSyncMemory = event.newValue
    cb()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
  return () => {
    tabSyncListeners.delete(cb)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

export function setSyncedTabTitle(title: string): void {
  if (!title) return
  if (tabSyncMemory === title) return
  tabSyncMemory = title
  try {
    localStorage.setItem(TAB_SYNC_STORAGE_KEY, title)
  } catch {
    /* private mode / quota — in-memory sync still works this session */
  }
  for (const listener of tabSyncListeners) listener()
}

/** Test-only: clear in-memory + storage preference. */
export function resetTabSyncForTests(): void {
  tabSyncMemory = undefined
  try {
    localStorage.removeItem(TAB_SYNC_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Resolve active index from a synced title, or fall back. Exact match first, then case-insensitive. */
export function resolveSyncedTabIndex(
  labels: string[],
  syncedTitle: string | null,
  fallbackIndex: number,
): number {
  if (!syncedTitle || labels.length === 0) return fallbackIndex
  const exact = labels.indexOf(syncedTitle)
  if (exact >= 0) return exact
  const lower = syncedTitle.toLowerCase()
  const loose = labels.findIndex((label) => label.toLowerCase() === lower)
  if (loose >= 0) return loose
  return fallbackIndex
}

function emptySubscribe(): () => void {
  return () => {}
}

const getNullTitle = (): string | null => null

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
  /** When true, selection syncs with other Tabs that share a matching title. */
  sync = false,
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
  const [localIndex, setLocalIndex] = useState(initialIndex)

  // Hydration-safe preference: server always null → defaultTabIndex; client
  // may pick up localStorage after hydrate without a useEffect race.
  const syncedTitle = useSyncExternalStore(
    sync ? subscribeSyncedTabTitle : emptySubscribe,
    sync ? getSyncedTabTitle : getNullTitle,
    getServerSyncedTabTitle,
  )
  const activeIndex = resolveSyncedTabIndex(labels, sync ? syncedTitle : null, localIndex)
  const activeTab = tabs[activeIndex]
  const uniqueId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const panelRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  const tabIds = tabs.map((tab, index) => tab.props.id ?? `${uniqueId}-tab-${index}`)

  const selectTab = (index: number) => {
    if (index === activeIndex) return
    setLocalIndex(index)
    if (sync) {
      const label = labels[index]
      if (label) setSyncedTabTitle(label)
    }
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
      {/*
        Full-width hairline + active primary underline both anchor to bottom-0
        of the header so the indicator sits on the content seam (Mintlify-style).
        Pseudo-element underline stays inside the tab box → not clipped by
        overflow-x-auto. borderBottom=false keeps plain title-only shells.
      */}
      <div className='relative flex items-stretch gap-2 pr-1'>
        {borderBottom && (
          <div
            aria-hidden
            className='pointer-events-none absolute inset-x-0 bottom-0 z-0 h-px bg-border/60'
          />
        )}
        {title && (
          <span className='relative z-10 shrink-0 self-center truncate pl-3 text-xs font-medium text-muted-foreground'>
            {title}
          </span>
        )}
        <div className='relative z-10 min-w-0 flex-1 overflow-x-auto scrollbar-none px-2.5'>
          <div
            role='tablist'
            aria-label={ariaLabel}
            className='flex h-full min-w-max items-stretch gap-3'
          >
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
                className={cn(
                  'relative flex cursor-pointer select-none items-center py-1.5 text-xs font-medium transition-colors duration-150 ease-out [-webkit-tap-highlight-color:transparent] focus:outline-none focus-visible:outline-none',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  borderBottom && active && 'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary after:content-[""]',
                )}
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
            className='relative z-10 my-0.5 flex size-[26px] shrink-0 cursor-pointer items-center justify-center self-center rounded-md text-muted-foreground transition-colors hover:text-foreground'
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
            the element itself so highlighting and props are preserved.
            Strip `title` from non-Tab elements because the tab bar already
            shows it — keeping it on the CodeBlock would duplicate the label. */}
        {activeTab?.type === Tab
          ? activeTab.props.children
          : activeTab && isValidElement(activeTab) && (activeTab.props as any).title
            ? React.cloneElement(activeTab as React.ReactElement<any>, { title: undefined })
            : activeTab}
      </div>
    </div>
  )
}

export function Tab({ children }: TabChildProps) {
  return <>{children}</>
}
