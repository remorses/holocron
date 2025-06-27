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

    // TODO change params to be branchId instead of siteId! then get the branch here
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
            },
        }),
        prisma.chat.findMany({
            where: {
                userId,
                branch: {
                    siteId,
                },
            },
            select: {
                chatId: true,
                title: true,
                createdAt: true,
                branch: {
                    select: {
                        githubBranch: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        }),
    ])

    if (!site) {
        throw new Error('Site not found')
    }

    return {
        site,

        siteId,
        chatHistory,
    }
}
export function Component({ loaderData }: Route.ComponentProps) {
    return <Outlet />
}
