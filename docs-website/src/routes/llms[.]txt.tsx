import { prisma } from 'db'
import type { Route } from './+types/llms[.]txt'
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
            branches: {
                take: 1,
            },
            locales: true,
        },
    })

    if (!site) {
        throw new Response('Site not found', { status: 404 })
    }

    const branch = site.branches[0]
    if (!branch) {
        throw new Response('Branch not found', { status: 404 })
    }

    const locales = site.locales.map((x) => x.locale)
    const source = await getFumadocsSource({
        defaultLocale: site.defaultLocale,
        branchId: branch.branchId,
        locales,
    })

    const siteName = site.name || 'Documentation'
    const baseUrl = `https://${domain}`
    
    // Get all pages from the source
    const pages = source.getPages()
    
    // Format as llms.txt with links ending in .md
    const linksText = pages
        .map((page) => {
            const title = page.data.title || 'Untitled'
            const url = `${baseUrl}${page.url}.md`
            return `- [${title}](${url})`
        })
        .join('\n')

    const llmsTxt = `# ${siteName}

## Docs

${linksText}`

    return new Response(llmsTxt, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}