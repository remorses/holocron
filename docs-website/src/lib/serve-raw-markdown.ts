import { prisma } from 'db'
import { getFilesForSource } from './source.server'
import { LOCALES } from './locales'
import { getFumadocsSource } from './source'

export async function serveRawMarkdown({
    domain,
    path,
    showLineNumbers = false,
    startLine,
    endLine,
}: {
    domain: string
    path: string
    showLineNumbers?: boolean
    startLine?: number
    endLine?: number
}) {
    const siteBranch = await prisma.siteBranch.findFirst({
        where: {
            domains: {
                some: {
                    host: domain,
                },
            },
        },
        include: {
            domains: true,
            site: {
                include: {
                    locales: true,
                },
            },
        },
    })

    const site = siteBranch?.site

    if (!site) {
        return null
    }

    if (!siteBranch) {
        return null
    }

    const languages = site.locales.map((x) => x.locale)
    const files = await getFilesForSource({
        branchId: siteBranch.branchId,
        githubFolder: siteBranch.site?.githubFolder || '',
    })
    const source = getFumadocsSource({
        defaultLanguage: site.defaultLocale,
        files,
        languages,
    })

    let slugs = path.split('/').filter((v) => v.length > 0) || []

    // Remove the .md or .mdx extension from the last slug
    if (slugs.length > 0) {
        const lastSlug = slugs[slugs.length - 1]
        if (lastSlug.endsWith('.md') || lastSlug.endsWith('.mdx')) {
            slugs[slugs.length - 1] = lastSlug.replace(/\.(md|mdx)$/, '')
        }
    }

    let locale = site.defaultLocale
    if (slugs[0] && LOCALES.includes(slugs[0] as any)) {
        locale = slugs[0]
        slugs = slugs.slice(1)
    }

    const fumadocsPage = source.getPage(slugs, locale)
    const slug = fumadocsPage?.url || '/' + slugs.join('/')

    let [page] = await Promise.all([
        prisma.markdownPage.findFirst({
            where: {
                slug,
                branchId: siteBranch.branchId,
            },
            include: {
                content: true,
            },
        }),
    ])

    if (!page && slug === '/') {
        // try to find index page if no page found
        let [indexPage] = await Promise.all([
            prisma.markdownPage.findFirst({
                where: {
                    slug: { in: ['/index', '/readme'] },
                    branchId: siteBranch.branchId,
                },
                include: {
                    content: true,
                },
            }),
        ])
        const markdown = indexPage?.content.markdown || null
        return markdown ? formatMarkdown(markdown, showLineNumbers, startLine, endLine) : null
    }

    if (!page) {
        return null
    }

    return formatMarkdown(page.content.markdown, showLineNumbers, startLine, endLine)
}

function formatMarkdown(
    markdown: string,
    showLineNumbers: boolean,
    startLine?: number,
    endLine?: number,
): string {
    const lines = markdown.split('\n')
    
    // Filter lines by range if specified
    const filteredLines = (() => {
        if (startLine !== undefined || endLine !== undefined) {
            const start = startLine ? startLine - 1 : 0 // Convert to 0-based index
            const end = endLine ? endLine : lines.length
            return lines.slice(start, end)
        }
        return lines
    })()
    
    // Add line numbers if requested
    if (showLineNumbers) {
        const startLineNumber = startLine || 1
        const maxLineNumber = startLineNumber + filteredLines.length - 1
        const padding = maxLineNumber.toString().length
        
        return filteredLines
            .map((line, index) => {
                const lineNumber = startLineNumber + index
                const paddedNumber = lineNumber.toString().padStart(padding, ' ')
                return `${paddedNumber}  ${line}`
            })
            .join('\n')
    }
    
    return filteredLines.join('\n')
}
