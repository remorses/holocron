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

export async function getFumadocsClientSource(
    serverSource: LoaderOutput<{ source: SourceData; i18n: true }>,
) {
    const files: VirtualFile[] = serverSource.getPages().map((x) => {
        const { data, path, url } = x
        let file: VirtualFile = {
            data,
            path,
            type: 'page',
        }
        return file
    })
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
        i18n: serverSource._i18n,
        // TODO return image that links icon in the server
        // icon(icon) {},

        // url: (slugs: string[], locale?: string) =>
        //     '/' + (locale ? locale + '/' : '') + slugs.join('/'),
    })

    return source
}
