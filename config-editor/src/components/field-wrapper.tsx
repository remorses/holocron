import * as React from 'react'
import { Label } from './ui/label'
import { cn } from '../lib/cn'

type FieldWrapperProps = {
  label: string
  description?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  className?: string
}

export function FieldWrapper({ label, description, error, required, children, className }: FieldWrapperProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
