import { lazy, Suspense } from 'react'
import { prefetchDNS, preconnect } from 'react-dom'
import { useHydrated } from './hooks'

// simple in-memory cache so every icon is fetched only once
const cache: Record<string, React.ComponentType<any>> = {}

type DynamicIconProps = { icon?: string } & React.SVGProps<SVGSVGElement>

export function DynamicIconInner({ icon: name, ...rest }: DynamicIconProps) {
    prefetchDNS('https://esm.sh')
    preconnect('https://esm.sh')
    const hidrated = useHydrated()
    if (!hidrated) return <EmptyIcon />
    if (!name) return null
    const Icon =
        cache[name] ||
        (cache[name] = lazy(() =>
            import(
                /* @vite-ignore */
                `https://esm.sh/lucide-react@0.525.0/es2022/dist/esm/icons/${name}.mjs`
            ).catch((e) => ({ default: EmptyIcon })),
        ))

    if (!Icon || EmptyIcon === Icon) {
        return null
    }
    return <Icon {...rest} className={(rest.className ?? '') + ' w-full'} />
}

function EmptyIcon() {
    return <div className='w-4 h-4' />
}

export function DynamicIcon({ icon: name, ...rest }: DynamicIconProps) {

    return (
        <Suspense
            fallback={
                <span className='block w-4 h-4 rounded transition-opacity opacity-0' />
            }
        >
            <DynamicIconInner icon={name} {...rest} />
        </Suspense>
    )
}
