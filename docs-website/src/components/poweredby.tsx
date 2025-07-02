import { cn } from '../lib/cn'

export function PoweredBy({ className }: { className?: string }) {
    return (
        <div className={cn('text-sm text-fd-muted-foreground', className)}>
            Powered by{' '}
            <b>
                <a
                    href='https://fumabase.com'
                    target='_blank'
                    className={cn('text-fd-muted-foreground')}
                >
                    Fumabase
                </a>
            </b>
        </div>
    )
}
