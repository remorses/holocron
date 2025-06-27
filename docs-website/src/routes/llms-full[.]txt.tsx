import { prisma } from 'db'
import type { Route } from './+types/llms-full[.]txt'
import { getFilesForSource, getFumadocsSource } from '../lib/source.server'

interface MatchResult {
    context: string
    relevanceScore: number
}

function extractMatchesWithContext(
    text: string,
    searchTerms: string[],
    contextSize: number = 150,
): string[] {
    if (searchTerms.length === 0) return []

    const regex = new RegExp(
        `(${searchTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
        'gi',
    )
    const matchResults: MatchResult[] = []
    const processedIndices = new Set<number>()

    let match
    while ((match = regex.exec(text)) !== null) {
        const matchStart = match.index
        const matchEnd = matchStart + match[0].length

        // Skip if we already processed a match that overlaps with this one
        if (processedIndices.has(matchStart)) continue

        // Find sentence boundaries for better context
        const contextStart = (() => {
            const roughStart = Math.max(0, matchStart - contextSize)
            const sentenceStart = text.lastIndexOf('.', matchStart - 1)
            const lineStart = text.lastIndexOf('\n', matchStart - 1)

            // Use sentence boundary if it's within reasonable distance
            if (sentenceStart > roughStart && sentenceStart < matchStart) {
                return sentenceStart + 1
            }
            if (lineStart > roughStart && lineStart < matchStart) {
                return lineStart + 1
            }
            return roughStart
        })()

        const contextEnd = (() => {
            const roughEnd = Math.min(text.length, matchEnd + contextSize)
            const sentenceEnd = text.indexOf('.', matchEnd)
            const lineEnd = text.indexOf('\n', matchEnd)

            // Use sentence boundary if it's within reasonable distance
            if (sentenceEnd !== -1 && sentenceEnd < roughEnd) {
                return sentenceEnd + 1
            }
            if (lineEnd !== -1 && lineEnd < roughEnd) {
                return lineEnd
            }
            return roughEnd
        })()

        // Mark this range as processed to avoid overlaps
        for (let i = contextStart; i < contextEnd; i++) {
            processedIndices.add(i)
        }

        let context = text.slice(contextStart, contextEnd).trim()

        // Add ellipsis if context doesn't start/end at text boundaries
        if (contextStart > 0) context = '...' + context
        if (contextEnd < text.length) context = context + '...'

        // Calculate relevance score based on match frequency and position
        const contextLower = context.toLowerCase()
        const matchCount = searchTerms.reduce((count, term) => {
            const termMatches = (
                contextLower.match(new RegExp(term.toLowerCase(), 'g')) || []
            ).length
            return count + termMatches
        }, 0)

        // Boost score for matches near beginning of context
        const positionBoost = matchStart < 100 ? 1.2 : 1.0
        const relevanceScore = matchCount * positionBoost

        // Highlight search terms in the context
        const highlightedContext = searchTerms.reduce((acc, term) => {
            const termRegex = new RegExp(
                `(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
                'gi',
            )
            return acc.replace(termRegex, '**$1**')
        }, context)

        matchResults.push({
            context: highlightedContext,
            relevanceScore,
        })
    }

    // Sort by relevance score and return top matches
    return matchResults
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10) // Limit to top 10 most relevant matches
        .map((result) => result.context)
}

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    // Extract search parameters
    const searchParams = url.searchParams
        .getAll('search')
        .filter((s) => s.trim().length > 0)

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
        throw new Response('Site not found', { status: 404 })
    }

    if (!siteBranch) {
        throw new Response('Branch not found', { status: 404 })
    }

    const locales = site.locales.map((x) => x.locale)
    const files = await getFilesForSource({ branchId: siteBranch.branchId })
    const source = await getFumadocsSource({
        defaultLocale: site.defaultLocale,
        files,
        locales,
    })

    const baseUrl = `https://${domain}`
    const pages = source.getPages()

    // Configuration
    const batchSize = 5

    // Create a readable stream for streaming the content
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()

            try {
                // Process pages in batches
                for (let i = 0; i < pages.length; i += batchSize) {
                    const batch = pages.slice(i, i + batchSize)
                    const slugs = batch.map((page) => page.url)

                    // Fetch markdown content for batch of pages
                    const markdownPages = await prisma.markdownPage.findMany({
                        where: {
                            slug: {
                                in: slugs,
                            },
                            branchId: siteBranch.branchId,
                        },
                        select: {
                            slug: true,
                            markdown: true,
                        },
                    })

                    // Create a map for quick lookup
                    const pageContentMap = new Map(
                        markdownPages.map((page) => [page.slug, page.markdown]),
                    )

                    // Stream each page in the batch
                    for (const page of batch) {
                        const sourceUrl = `${baseUrl}${page.url}`
                        const markdown = pageContentMap.get(page.url)

                        if (markdown) {
                            let content = markdown

                            if (searchParams.length > 0) {
                                // Extract matches with context
                                const matches = extractMatchesWithContext(
                                    markdown,
                                    searchParams,
                                )

                                // Skip pages without matches
                                if (matches.length === 0) continue

                                content = matches.join('\n\n━━━\n\n')
                            }

                            const pageTitle = page.data?.title || 'Untitled'
                            const section = `# ${pageTitle}\n\n**Source:** ${sourceUrl}\n\n${content}\n\n═══════════════════════════════════════════════════════════════════════════════\n\n`
                            controller.enqueue(encoder.encode(section))
                        }
                    }
                }
            } catch (error) {
                controller.error(error)
            } finally {
                controller.close()
            }
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
