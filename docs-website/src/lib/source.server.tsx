import { prisma } from 'db'
import { loader, MetaData, PageData, VirtualFile } from 'fumadocs-core/source'
import { getIconJsx } from './icons.server'
import { I18nConfig } from 'fumadocs-core/i18n'
import { StructuredData } from './mdx'

export async function getFumadocsSource({
    tabId,
    locales = [] as string[],
    defaultLocale = 'en',
}) {
    const [allPages, metaFiles] = await Promise.all([
        prisma.markdownPage.findMany({
            where: {
                tabId,
            },
            omit: {
                // frontmatter: true,
                markdown: true,
                // description: true,
            },
        }),
        prisma.metaFile.findMany({
            where: {
                tabId,
            },
            omit: {},
        }),
    ])

    const files = allPages
        .map((x) => {
            const structuredData = x.structuredData
            const res: VirtualFile = {
                data: { ...(x.frontmatter as any), structuredData },
                path: x.githubPath,
                type: 'page',

                // slugs
            }
            return res
        })
        .concat(
            metaFiles.map((x) => {
                const res: VirtualFile = {
                    data: x.jsonData,
                    path: x.githubPath,
                    type: 'meta',
                }
                return res
            }),
        )

    const languages = locales
    if (!languages.includes(defaultLocale)) {
        languages.push(defaultLocale)
    }
    const source = loader<SourceData, I18nConfig>({
        source: { files },
        baseUrl: '/', // TODO pass here the customer base path
        i18n: {
            defaultLanguage: defaultLocale,
            languages,
            hideLocale: 'default-locale',
        },
        icon(icon) {
            return getIconJsx({ key: icon })!
        },

        // url: (slugs: string[], locale?: string) =>
        //     '/' + (locale ? locale + '/' : '') + slugs.join('/'),
    })
    return source
}

export type SourceData = {
    pageData: PageData & {
        structuredData: StructuredData
    }
    metaData: MetaData
}
