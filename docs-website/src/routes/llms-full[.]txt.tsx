import { prisma } from 'db'
import type { Route } from './+types/llms-full[.]txt'
import { generateLlmsFullTxt } from '../lib/llms-full-txt'

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    // Extract search parameters and combine into a single query
    const searchParams = url.searchParams
        .getAll('search')
        .filter((s) => s.trim().length > 0)
    const searchQuery = searchParams.join(' ')

    const content = await generateLlmsFullTxt({
        domain,
        searchQuery: searchQuery || undefined,
    })

    return new Response(content || `Nothing matching the terms "${searchParams}" found`, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
        },
    })
}
