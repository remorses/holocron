import * as React from 'react'
import { CheckIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, ...props }, ref) => {
  return (
    <div className="relative inline-flex items-center">
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          'peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 appearance-none checked:bg-primary checked:border-primary',
          className,
        )}
        {...props}
      />
      <CheckIcon className="absolute h-3 w-3 left-0.5 top-0.5 text-primary-foreground pointer-events-none opacity-0 peer-checked:opacity-100" />
    </div>
  )
})
Checkbox.displayName = 'Checkbox'

export { Checkbox }
