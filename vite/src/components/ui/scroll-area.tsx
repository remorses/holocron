/**
 * Minimal scroll-area wrappers for the sidebar port.
 */

import type { ComponentProps } from 'react'
import { cn } from '../../utils/cn.ts'

export function ScrollArea({ children, className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-h-0 flex-1', className)} {...props}>{children}</div>
}

export function ScrollViewport({ children, className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('size-full rounded-[inherit]', className)} {...props}>{children}</div>
}

export type ScrollAreaProps = ComponentProps<'div'>
