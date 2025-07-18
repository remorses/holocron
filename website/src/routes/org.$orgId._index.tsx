import { prisma } from 'db'
import { redirect } from 'react-router'
import { href } from 'react-router'
import { getSession } from '../lib/better-auth'
import type { Route } from './+types/org.$orgId._index'

export async function loader({ request, params: { orgId } }: Route.LoaderArgs) {
    const { userId, redirectTo } = await getSession({ request })
    if (redirectTo) {
        throw redirect(redirectTo)
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

    // Find the first site in this org, ordered by creation date (newest first)
    const site = await prisma.site.findFirst({
        where: {
            orgId,
            branches: {
                some: {
                    pages: {
                        some: {},
                    },
                },
            },
        },
        include: {
            // TODO change the param siteId to be branchId instead
            branches: {
                take: 1,
                orderBy: {
                    createdAt: 'desc',
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    if (!site) {
        throw redirect(href('/org/:orgId/onboarding', { orgId }))
    }

    // Find the first chat for this user in this site, ordered by creation date (newest first)
    const branchId = site.branches[0]?.branchId
    if (!branchId) {
        throw redirect(href('/org/:orgId/onboarding', { orgId }))
    }

    const chat = await prisma.chat.findFirst({
        where: {
            branchId,
            userId,
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    if (!chat) {
        // If no chat exists, we could create one or redirect to a different route
        // For now, redirect to dashboard as we don't have a route to create a chat
        throw redirect(href('/org/:orgId/onboarding', { orgId }))
    }

    // Redirect to the specific chat
    throw redirect(
        href('/org/:orgId/site/:siteId/chat/:chatId', {
            orgId,
            siteId: site.siteId,
            chatId: chat.chatId,
        }),
    )
}

// This route only handles redirection, so no component is needed
export default function OrgRedirect() {
    return null
}
