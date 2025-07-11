import { prisma } from 'db'
import type { Route } from './+types/llms-full[.]txt'
import { generateLlmsFullTxt } from '../lib/llms-full-txt'
import { getCacheTagForPage } from '../lib/cache-tags'

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    // Extract search parameters and combine into a single query
    const searchParams = url.searchParams
        .getAll('search')
        .filter((s) => s.trim().length > 0)
    const searchQuery = searchParams.join(' ')

    // Get site branch to create cache tag
    const siteBranch = await prisma.siteBranch.findFirst({
        where: {
            domains: {
                some: {
                    host: domain,
                },
            },
        },
        select: {
            branchId: true,
        },
    })

    const content = await generateLlmsFullTxt({
        domain,
        searchQuery: searchQuery || undefined,
    })

    const cacheTag = siteBranch ? getCacheTagForPage({
        branchId: siteBranch.branchId,
        slug: '/llms-full.txt',
    }) : undefined

    return new Response(content || `Nothing matching the terms "${searchParams}" found`, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=300, s-maxage=300',
            ...(cacheTag && { 'Cache-Tag': cacheTag }),
        },
    })
}
