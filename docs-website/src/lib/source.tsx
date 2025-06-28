import { loader, MetaData, PageData, VirtualFile } from 'fumadocs-core/source'

import { I18nConfig } from 'fumadocs-core/i18n'
import React, { lazy, Suspense } from 'react'
import { useHydrated } from './hooks'
import { StructuredData } from './mdx-heavy'
import { prefetchDNS, preconnect } from 'react-dom'

// simple in-memory cache so every icon is fetched only once
const cache: Record<string, React.ComponentType<any>> = {}

type DynamicIconProps = { name: string } & React.SVGProps<SVGSVGElement>

export function DynamicIconInner({ name, ...rest }: DynamicIconProps) {
    prefetchDNS('https://esm.sh')
    preconnect('https://esm.sh')
    const hidrated = useHydrated()
    if (!hidrated) return null
    const Icon =
        cache[name] ||
        (cache[name] = lazy(
            () =>
                import(
                    /* @vite-ignore */
                    `https://esm.sh/lucide-react@0.525.0/es2022/dist/esm/icons/${name}.mjs`
                ),
        ))

    return (
        <span className='inline-block w-4 h-4 align-middle animate-fade-in'>
            <Icon {...rest} className={(rest.className ?? '') + ' w-full'} />
        </span>
    )
}

export function DynamicIcon({ name, ...rest }: DynamicIconProps) {
    return (
        <Suspense
            fallback={
                <span className='inline-block w-4 h-4 rounded transition-opacity opacity-0' />
            }
        >
            <DynamicIconInner name={name} {...rest} />
        </Suspense>
    )
}

export function getFumadocsClientSource({
    files,
    i18n,
}: {
    i18n?: I18nConfig
    files: VirtualFile[]
}) {
    const source = loader<
        {
            pageData: PageData & {
                structuredData: StructuredData
            }
            metaData: MetaData
        },
        I18nConfig
    >({
        source: { files },
        baseUrl: '/', // TODO pass here the customer base path
        i18n,

        icon(icon) {
            if (!icon) return
            return (
                <React.Suspense fallback={null}>
                    <DynamicIcon name={icon as any} />
                </React.Suspense>
            )
        },
        // TODO loading using an img would be better, but no support for currentColor and good size
        // icon(icon) {
        //     // console.log('icon', icon)
        //     if (!icon) return
        //     return (
        //         <img
        //             src={`/api/icons/lucide/icon/${icon}.svg`}
        //             alt={''}
        //             style={{ display: 'inline-block', verticalAlign: 'middle' }}
        //             height={16}
        //             width={16}
        //             // loading='lazy'
        //         />
        //     )
        // },
    })

    return source
}
