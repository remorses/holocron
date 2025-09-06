import * as Slot from '@radix-ui/react-slot'

import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../lib/cn.js'

export function Cards(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={cn('grid mt-auto grid-cols-2 gap-4 @container', props.className)}>
      {props.children}
    </div>
  )
}

export type CardProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  asChild?: boolean
  href?: string
  external?: boolean
}
export function Card({ icon, title, description, asChild, ...props }: CardProps) {
  const Comp = asChild ? Slot.Root : 'a'

  return (
    <Comp
      {...props}
      data-card
      className={cn(
        'block rounded-lg border bg-card p-4 text-card-foreground shadow-md transition-colors @max-lg:col-span-1',
        props.href && 'hover:bg-accent/80',
        props.className,
      )}
    >
      {icon ? (
        <div className='not-prose mb-2 w-fit rounded-md border bg-muted p-1.5 text-muted-foreground [&_svg]:size-4'>
          {icon}
        </div>
      ) : null}
      <h3 className='not-prose mb-1 text-sm font-medium'>{title}</h3>
      {description ? <p className='!my-0 text-sm text-muted-foreground'>{description}</p> : null}
      {props.children ? <div className='text-sm text-muted-foreground prose-no-margin'>{props.children}</div> : null}
    </Comp>
  )
}
