import { prisma } from 'db'
import { loader, MetaData, PageData, VirtualFile } from 'fumadocs-core/source'
import { getIconJsx } from './icons.server'
import { I18nConfig } from 'fumadocs-core/i18n'
import { StructuredData } from './mdx-heavy'
import { deduplicateBy } from './utils'

export async function getFilesForSource({ branchId, githubFolder }) {
    const [allPages, metaFiles] = await Promise.all([
        prisma.markdownPage.findMany({
            where: {
                branchId,
            },
            include: {
                content: {
                    select: {
                        structuredData: true,
                    },
                },
            },
        }),
        prisma.metaFile.findMany({
            where: {
                branchId,
            },
            omit: {},
        }),
    ])

    const files = allPages
        .map((x) => {
            const structuredData = x.content.structuredData
            let githubPath = x.githubPath
            if (githubPath.startsWith(githubFolder)) {
                githubPath = githubPath.slice(githubFolder.length)
            }
            const res: VirtualFile = {
                data: { ...(x.frontmatter as any), structuredData },
                path: githubPath,
                type: 'page',

                // slugs
            }
            return res
        })
        .concat(
            metaFiles.map((x) => {
                let githubPath = x.githubPath
                if (githubPath.startsWith(githubFolder)) {
                    githubPath = githubPath.slice(githubFolder.length)
                }
                const res: VirtualFile = {
                    data: x.jsonData,
                    path: githubPath,
                    type: 'meta',
                }
                return res
            }),
        )

    return deduplicateBy(files, (file) => file.path)
}
