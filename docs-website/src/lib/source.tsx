import {
    loader,
    LoaderOutput,
    MetaData,
    PageData,
    VirtualFile,
} from 'fumadocs-core/source'

import { I18nConfig } from 'fumadocs-core/i18n'
import { StructuredData } from './mdx-heavy'
import { icons } from 'lucide-react'
import { SourceData } from './source.server'
import { createElement } from 'react'
import { pascalcase } from './utils'

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
            icon = pascalcase(icon)
            if (icon && icon in icons)
                return createElement(icons[icon as keyof typeof icons])
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
