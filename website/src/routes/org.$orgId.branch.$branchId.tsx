import { prisma } from 'db'
import { Outlet } from 'react-router'
import { getSession } from '../lib/better-auth'
import type { Route } from './+types/org.$orgId.branch.$branchId'
import { env } from '../lib/env'

export type { Route }

export async function loader({
    request,
    params: { orgId, branchId },
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

    const [siteBranch, chatHistory, siteBranches] = await Promise.all([
        prisma.siteBranch.findFirst({
            where: {
                branchId: branchId,
                site: {
                    org: {
                        users: {
                            some: { userId },
                        },
                    },
                },
            },
            include: {
                site: {
                    include: {
                        org: true,
                        githubInstallations: {
                            where: {
                                appId: env.GITHUB_APP_ID!,
                            },
                        },
                    },
                },
            },
        }),
        prisma.chat.findMany({
            where: {
                userId,
                branchId,
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
                siteId: branchId,
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

    if (!siteBranch) {
        throw new Error('Branch not found')
    }

    const site = siteBranch.site
    const siteId = site.siteId

    // Get all branches for this site
    const allSiteBranches = await prisma.siteBranch.findMany({
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
    })

    return {
        site,
        siteId,
        branchId,
        siteBranch,
        chatHistory,
        siteBranches: allSiteBranches,
    }
}
export function Component({ loaderData }: Route.ComponentProps) {
    return <Outlet />
}
