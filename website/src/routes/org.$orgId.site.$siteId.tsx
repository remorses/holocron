import { prisma } from 'db'
import { Outlet } from 'react-router'
import { getSession } from '../lib/better-auth'
import type { Route } from './+types/org.$orgId.site.$siteId'


export type { Route }

export async function loader({
    request,
    params: { orgId, siteId },
}: Route.LoaderArgs) {
    // We need userId for the queries, get it from session
    const { userId } = await getSession({ request })

    const [site, chatHistory] = await Promise.all([
        prisma.site.findUnique({
            where: {
                siteId: siteId,
                org: {
                    users: {
                        some: { userId },
                    },
                },
            },
            include: {
                org: true,
                domains: true,
                branches: true,
            },
        }),
        prisma.chat.findMany({
            where: {
                siteId,
                userId,
            },
            select: {
                chatId: true,
                title: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        }),
    ])

    if (!site) {
        throw new Error('Site not found')
    }

    const host = site.domains.find(
        (x) => x.domainType === 'internalDomain',
    )?.host

    const iframeUrl = new URL(`https://${host}`)
    if (host?.endsWith('.localhost')) {
        iframeUrl.protocol = 'http:'
        iframeUrl.port = '7777'
    }

    const branchId = site.branches[0].branchId

    return {
        site,
        iframeUrl,
        host,
        siteId,
        branchId,
        chatHistory,
    }
}
export function Component({ loaderData }: Route.ComponentProps) {
    return <Outlet />
}
