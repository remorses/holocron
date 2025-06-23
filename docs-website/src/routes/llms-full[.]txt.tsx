import { prisma } from 'db'
import type { Route } from './+types/llms-full[.]txt'
import { getFumadocsSource } from '../lib/source.server'

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    const site = await prisma.site.findFirst({
        where: {
            domains: {
                some: {
                    host: domain,
                },
            },
        },
        include: {
            domains: true,
            tabs: {
                take: 1,
            },
            locales: true,
        },
    })

    if (!site) {
        throw new Response('Site not found', { status: 404 })
    }

    const tab = site.tabs[0]
    if (!tab) {
        throw new Response('Tab not found', { status: 404 })
    }

    const locales = site.locales.map((x) => x.locale)
    const source = await getFumadocsSource({
        defaultLocale: site.defaultLocale,
        tabId: tab.tabId,
        locales,
    })

    const baseUrl = `https://${domain}`
    const pages = source.getPages()

    // Create a readable stream for streaming the content
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder()

            try {
                // Process pages in batches of 5
                for (let i = 0; i < pages.length; i += 5) {
                    const batch = pages.slice(i, i + 5)
                    const slugs = batch.map(page => page.url)
                    
                    // Fetch markdown content for batch of pages
                    const markdownPages = await prisma.markdownPage.findMany({
                        where: {
                            slug: {
                                in: slugs,
                            },
                            tabId: tab.tabId,
                        },
                        select: {
                            slug: true,
                            markdown: true,
                        },
                    })

                    // Create a map for quick lookup
                    const pageContentMap = new Map(
                        markdownPages.map(page => [page.slug, page.markdown])
                    )

                    // Stream each page in the batch
                    for (const page of batch) {
                        const sourceUrl = `${baseUrl}${page.url}`
                        const markdown = pageContentMap.get(page.url)
                        
                        if (markdown) {
                            const section = `source: ${sourceUrl}\n\n${markdown}\n\n---\n\n`
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