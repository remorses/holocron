import { prisma } from 'db'
import { loader, VirtualFile } from 'fumadocs-core/source'

export async function getFumadocsSource({ tabId }) {
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

    const source = loader({
        source: { files },
        baseUrl: '/',
        i18n: {
            defaultLanguage: 'en',
            languages: ['en', 'cn'],
            hideLocale: 'default-locale',
        },
        // icon(icon) {
        //     return null
        // },
        // url: (slugs: string[], locale?: string) =>
        //     '/' + (locale ? locale + '/' : '') + slugs.join('/'),
    })
    return source
}
