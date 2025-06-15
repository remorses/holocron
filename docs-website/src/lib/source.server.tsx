import { prisma } from 'db'
import { loader, VirtualFile } from 'fumadocs-core/source'
import { getIconJsx } from './icons.server'

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
            const res: VirtualFile = {
                data: x.frontmatter,
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
    const source = loader({
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
