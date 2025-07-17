import { prisma } from 'db'
import { getFilesForSource } from './source.server'
import { LOCALES } from './locales'
import { getFumadocsSource } from './source'
import { getCacheTagForPage } from './cache-tags'

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
}): Promise<{ markdown: string; cacheTag: string } | null> {
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
        const markdown = indexPage?.content?.markdown || null
        if (markdown) {
            const formattedMarkdown = formatMarkdown(markdown, showLineNumbers, startLine, endLine)
            const cacheTag = getCacheTagForPage({
                branchId: siteBranch.branchId,
                slug: indexPage?.slug || '/',
                locale,
            })
            return { markdown: formattedMarkdown, cacheTag }
        }
        return null
    }

    if (!page) {
        return null
    }

    const formattedMarkdown = formatMarkdown(page.content?.markdown ||'', showLineNumbers, startLine, endLine)
    const cacheTag = getCacheTagForPage({
        branchId: siteBranch.branchId,
        slug: page.slug,
        locale,
    })
    return { markdown: formattedMarkdown, cacheTag }
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
            const start = startLine ? Math.max(0, startLine - 1) : 0 // Convert to 0-based index, ensure non-negative
            const end = endLine ? Math.min(endLine, lines.length) : lines.length // Don't exceed file length
            return lines.slice(start, end)
        }
        return lines
    })()

    // Check if content is truncated
    const actualStart = startLine ? Math.max(0, startLine - 1) : 0
    const actualEnd = endLine ? Math.min(endLine, lines.length) : lines.length
    const hasContentAbove = actualStart > 0
    const hasContentBelow = actualEnd < lines.length

    // Show line numbers if requested or if line ranges are specified
    const shouldShowLineNumbers = showLineNumbers || startLine !== undefined || endLine !== undefined

    // Add line numbers if requested
    if (shouldShowLineNumbers) {
        const startLineNumber = startLine || 1
        const maxLineNumber = startLineNumber + filteredLines.length - 1
        const padding = maxLineNumber.toString().length

        const formattedLines = filteredLines
            .map((line, index) => {
                const lineNumber = startLineNumber + index
                const paddedNumber = lineNumber.toString().padStart(padding, ' ')
                return `${paddedNumber}  ${line}`
            })

        // Add end of file indicator if at the end
        const result: string[] = []
        result.push(...formattedLines)
        if (!hasContentBelow) {
            result.push('end of file')
        }

        return result.join('\n')
    }

    // For non-line-numbered output, also add end of file indicator
    const result: string[] = []
    result.push(...filteredLines)
    if (!hasContentBelow) {
        result.push('end of file')
    }

    return result.join('\n')
}
