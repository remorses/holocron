import { cn } from '../lib/cn'
import { WEBSITE_DOMAIN } from '../lib/env'
import { useDocsJson } from '../lib/hooks'

export function PoweredBy({ className }: { className?: string }) {
  const docsJson = useDocsJson()
  const poweredBy = docsJson?.poweredBy
  
  const name = poweredBy?.name || 'Holocron'
  const url = poweredBy?.url || `https://${WEBSITE_DOMAIN}`
  
  return (
    <div className={cn('text-sm text-fd-muted-foreground', className)}>
      Powered by{' '}
      <b>
        <a href={url} target='_blank' className={cn('text-fd-muted-foreground')}>
          {name}
        </a>
      </b>
    </div>
  )
}
