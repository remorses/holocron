import {
    loader,
    LoaderOutput,
    MetaData,
    PageData,
    VirtualFile,
} from 'fumadocs-core/source'

import { I18nConfig } from 'fumadocs-core/i18n'
import { StructuredData } from './mdx'
import { SourceData } from './source.server'

export async function getFumadocsClientSource({
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
            return (
                <img
                    src={`/api/icons/lucide/icon/${icon}`}
                    alt={icon}
                    style={{ display: 'inline-block', verticalAlign: 'middle' }}
                    // height={icon.size}
                    // width={icon.size}
                    loading='lazy'
                />
            )
        },
    })

    return source
}
