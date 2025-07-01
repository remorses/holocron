import type { Route } from './+types/api.search'

import { prisma } from 'db'
import { searchDocsWithTrieve } from '../lib/trieve-search'

export async function loader({ request }: Route.LoaderArgs) {
    const url = new URL(request.url)
    const domain = url.hostname.split(':')[0]

    const siteBranch = await prisma.siteBranch.findFirst({
        where: {
            domains: {
                some: {
                    host: domain,
                },
            },
        },
        include: {
            site: {
                include: {
                    locales: true,
                },
            },
        },
    })

    const site = siteBranch?.site
    const branchId = siteBranch?.branchId

    if (!branchId || !site) {
        throw new Response('Branch not found', { status: 404 })
    }

    const params = url.searchParams
    const query = params.get('query') || ''
    const locale = params.get('locale') || ''
    const tag = params.get('tag') || ''
    const defaultLocale = site?.defaultLocale
    const locales = site?.locales?.map((x) => x.locale)

    const results = await searchDocsWithTrieve({
        trieveDatasetId: siteBranch.trieveDatasetId,
        query,
        tag,
    })
    return new Response(JSON.stringify(results, null, 2), {
        headers: {
            'Content-Type': 'application/json',
        },
    })
}
