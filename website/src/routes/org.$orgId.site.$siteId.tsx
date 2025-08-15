import { prisma } from 'db'
import { Outlet } from 'react-router'
import { getSession } from '../lib/better-auth'
import type { Route } from './+types/org.$orgId.site.$siteId'
import { env } from '../lib/env'

export type { Route }

export async function loader({
    request,
    params: { orgId, siteId },
}: Route.LoaderArgs) {
    // Check if request is aborted early
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    // We need userId for the queries, get it from session
    const { userId } = await getSession({ request })

    // Check signal before database queries
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    const [site, chatHistory, siteBranches] = await Promise.all([
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
                githubInstallations: {
                    where: {
                        appId: env.GITHUB_APP_ID!,
                    },
                },
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
        prisma.siteBranch.findMany({
            where: {
                siteId,
            },
            select: {
                branchId: true,
                githubBranch: true,
            },
            orderBy: {
                createdAt: 'asc',
            },
        }),
    ])

    if (!site) {
        throw new Error('Site not found')
    }

    return {
        site,
        siteId,
        chatHistory,
        siteBranches,
    }
}
export function Component({ loaderData }: Route.ComponentProps) {
    return <Outlet />
}
