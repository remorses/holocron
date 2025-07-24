import { prisma } from 'db'
import { redirect, Outlet } from 'react-router'
import { getSession } from '../lib/better-auth'
import { href } from 'react-router'
import type { Route } from './+types/org.$orgId'

export type { Route }

export async function loader({ request, params: { orgId } }: Route.LoaderArgs) {
    // Check if request is aborted early
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    const { userId, redirectTo } = await getSession({ request })
    if (redirectTo) {
        throw redirect(redirectTo)
    }

    // Check signal before database query
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    // Check if user has access to this org
    const orgUser = await prisma.orgsUsers.findUnique({
        where: {
            userId_orgId: {
                userId: userId!,
                orgId: orgId,
            },
        },
    })

    if (!orgUser) {
        throw redirect(href('/org/:orgId/onboarding', { orgId }))
    }

    // Check signal before fetching user sites
    if (request.signal.aborted) {
        throw new Error('Request aborted')
    }

    // Fetch user sites for sidebar
    const userSites = await prisma.site.findMany({
        where: {
            org: {
                users: {
                    some: {
                        userId,
                    },
                },
            },
        },
        include: {
            org: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    return {
        userId,
        orgId,
        orgUser,
        userSites,
    }
}
export function Component({ loaderData }: Route.ComponentProps) {
    return <Outlet />
}
