import { cn } from '../lib/cn'
import { WEBSITE_DOMAIN } from '../lib/env'

export function PoweredBy({ className }: { className?: string }) {
  return (
    <div className={cn('text-sm text-fd-muted-foreground', className)}>
      Powered by{' '}
      <b>
        <a
          href={`https://${WEBSITE_DOMAIN}`}
          target='_blank'
          className={cn('text-fd-muted-foreground')}
        >
          Holocron
        </a>
      </b>
    </div>
  )
}
