/**
 * Minimal collapsible primitives for the sidebar port.
 */

import type { ComponentProps, ReactNode } from 'react'

export function Collapsible({ children, ...props }: ComponentProps<'div'> & { children?: ReactNode }) {
  return <div {...props}>{children}</div>
}

export function CollapsibleTrigger({ children, ...props }: ComponentProps<'button'> & { children?: ReactNode }) {
  return <button type='button' {...props}>{children}</button>
}

export function CollapsibleContent({ children, hidden, ...props }: ComponentProps<'div'> & { children?: ReactNode }) {
  if (hidden) {
    return null
  }
  return <div {...props}>{children}</div>
}

export type CollapsibleProps = ComponentProps<'div'>
export type CollapsibleContentProps = ComponentProps<'div'>
export type CollapsibleTriggerProps = ComponentProps<'button'>
