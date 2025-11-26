import * as React from 'react'
import { cn } from '../lib/cn'

type BlockWrapperProps = {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}

export function BlockWrapper({ title, description, children, className }: BlockWrapperProps) {
  return (
    <div className={cn('rounded-lg bg-card p-4 space-y-4', className)}>
      <div className="space-y-1">
        <h3 className="font-medium text-sm">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}
