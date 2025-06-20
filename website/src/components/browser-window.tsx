import { RefreshCwIcon } from 'lucide-react'
import { cn } from 'website/src/lib/utils'

export function BrowserWindow({
    children,
    className = '',
    onRefresh,
    onSearchBarClick,
    url,
}) {
    const host = new URL(url).host
    return (
        <figure
            className={cn(
                'shadow-xl rounded-b-md relative max-w-full h-full',
                'z-[1] shadow-[0_2.75rem_3.5rem_-2rem_rgb(45_55_75_/_20%),_0_0_5rem_-2rem_rgb(45_55_75_/_15%)]',
                'dark:shadow-[0_2.75rem_3.5rem_-2rem_rgb(0_0_0_/_20%),_0_0_5rem_-2rem_rgb(0_0_0_/_15%)]',
                className,
            )}
        >
            <div
                className={cn(
                    'rounded-t-md relative py-2 pl-24 items-center',
                    'flex bg-muted dark:bg-muted',
                )}
            >
                <div
                    className={cn(
                        'top-2/4 space-x-2 left-4 flex absolute -translate-y-1',
                        '[&>span]:w-3 [&>span]:h-3',
                    )}
                >
                    <span className=' bg-muted-foreground/40 rounded-full dark:bg-muted-foreground/40' />
                    <span className=' bg-muted-foreground/40 rounded-full dark:bg-muted-foreground/40' />
                    <span className=' bg-muted-foreground/40 rounded-full dark:bg-muted-foreground/40' />
                </div>
                <a
                    href={url}
                    onClick={onSearchBarClick}
                    target='_blank'
                    className={cn(
                        'truncate text-muted-foreground rounded px-40 mx-auto',
                        'justify-center items-center h-full flex bg-secondary',
                        'appereance-none dark:bg-secondary',
                    )}
                >
                    {host}
                </a>
                <div className='pr-20'></div>
                <button
                    aria-label='refresh'
                    onClick={onRefresh}
                    className={cn(
                        'text-muted-foreground rounded ring-border p-px opacity-70',
                        'appereance-none hover:ring-1 active:opacity-30',
                    )}
                    children={<RefreshCwIcon className='h-4' />}
                />
                <div className='pr-4'></div>
            </div>
            <div
                className={cn(
                    'rounded-b-md relative overflow-hidden flex-col',
                    'flex-1',
                )}
            >
                {children}
            </div>
        </figure>
    )
}
