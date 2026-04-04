/**
 * Sidebar primitives modeled after Fumadocs, adapted for Holocron's local tree.
 */

'use client'

import {
  type ComponentProps,
  type RefObject,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link } from 'spiceflow/react'
import { ScrollArea, ScrollViewport, type ScrollAreaProps } from '../ui/scroll-area.tsx'
import { cn } from '../../utils/cn.ts'

type FolderContextValue = {
  open: boolean
  setOpen: (next: boolean) => void
  depth: number
  collapsible: boolean
}

const FolderContext = createContext<FolderContextValue | null>(null)

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      data-icon='true'
      aria-hidden='true'
      viewBox='0 0 16 16'
      width='12'
      height='12'
      className={className}
    >
      <path d='M5 3l5 5-5 5' fill='none' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
  )
}

export function useFolder() {
  return useContext(FolderContext)
}

export function useFolderDepth(): number {
  return useContext(FolderContext)?.depth ?? 0
}

export function SidebarViewport({ className, children, ...props }: ScrollAreaProps) {
  return (
    <ScrollArea className={className} {...props}>
      <ScrollViewport className='overscroll-contain mask-[linear-gradient(to_bottom,transparent,white_12px,white_calc(100%-12px),transparent)] hc-scroll-container'>
        {children}
      </ScrollViewport>
    </ScrollArea>
  )
}

export function SidebarSeparator(props: ComponentProps<'p'>) {
  return <p {...props}>{props.children}</p>
}

function useAutoScroll(active: boolean, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active || !ref.current) {
      return
    }

    ref.current.scrollIntoView({ block: 'nearest' })
  }, [active, ref])
}

export function SidebarItem({
  active = false,
  external = false,
  className,
  children,
  ...props
}: ComponentProps<'a'> & {
  active?: boolean
  external?: boolean
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  useAutoScroll(active, ref)

  if (external) {
    return (
      <a
        ref={ref}
        data-active={active}
        className={className}
        target='_blank'
        rel='noreferrer'
        {...props}
      >
        {children}
      </a>
    )
  }

  return (
    <Link
      ref={ref}
      data-active={active}
      className={className}
      {...props}
    >
      {children}
    </Link>
  )
}

export function SidebarFolder({
  children,
  depth,
  open: openProp,
  onOpenChange,
  collapsible = true,
  defaultOpen = false,
  ...props
}: ComponentProps<'div'> & {
  depth: number
  open?: boolean
  onOpenChange?: (next: boolean) => void
  collapsible?: boolean
  defaultOpen?: boolean
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <FolderContext.Provider value={useMemo(() => ({ open, setOpen, depth, collapsible }), [collapsible, depth, open, setOpen])}>
      <div data-open={open} {...props}>{children}</div>
    </FolderContext.Provider>
  )
}

export function SidebarFolderTrigger({ className, children, onClick, ...props }: ComponentProps<'button'>) {
  const folder = useFolder()
  if (!folder) {
    return null
  }

  if (!folder.collapsible) {
    return <div className={className}>{children}</div>
  }

  return (
    <button
      type='button'
      aria-expanded={folder.open}
      className={className}
      onClick={(e) => {
        folder.setOpen(!folder.open)
        onClick?.(e)
      }}
      {...props}
    >
      <span className='min-w-0 flex-1 wrap-anywhere'>{children}</span>
      <span
        data-icon='true'
        className='ms-auto inline-flex shrink-0 items-center'
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          folder.setOpen(!folder.open)
        }}
      >
        <ChevronDownIcon className={cn('transition-transform', folder.open ? 'rotate-0' : 'rotate-90 rtl:-rotate-90')} />
      </span>
    </button>
  )
}

export function SidebarFolderLink({
  children,
  active = false,
  external = false,
  className,
  onClick,
  ...props
}: ComponentProps<'a'> & {
  active?: boolean
  external?: boolean
}) {
  const ref = useRef<HTMLAnchorElement>(null)
  const folder = useFolder()
  useAutoScroll(active, ref)

  if (!folder) {
    return null
  }

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (folder.collapsible) {
      if (active) {
        folder.setOpen(!folder.open)
      } else {
        folder.setOpen(true)
      }
    }
    onClick?.(e)
  }

  const chevron = folder.collapsible && (
    <span
      data-icon='true'
      className='ms-auto inline-flex shrink-0 items-center'
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        folder.setOpen(!folder.open)
      }}
    >
      <ChevronDownIcon className={cn('transition-transform', folder.open ? 'rotate-0' : 'rotate-90 rtl:-rotate-90')} />
    </span>
  )

  if (external) {
    return (
      <a
        ref={ref}
        data-active={active}
        className={className}
        target='_blank'
        rel='noreferrer'
        onClick={handleClick}
        {...props}
      >
        <span className='min-w-0 flex-1 wrap-anywhere'>{children}</span>
        {chevron}
      </a>
    )
  }

  return (
    <Link
      ref={ref}
      data-active={active}
      className={className}
      onClick={handleClick}
      {...props}
    >
      <span className='min-w-0 flex-1 wrap-anywhere'>{children}</span>
      {chevron}
    </Link>
  )
}

export function SidebarFolderContent({ children, className, ...props }: ComponentProps<'div'>) {
  const folder = useFolder()
  if (!folder) {
    return null
  }

  if (folder.collapsible && !folder.open) {
    return null
  }

  return <div className={className} {...props}>{children}</div>
}
