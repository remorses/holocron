import { prisma } from 'db'
import { redirect } from 'react-router'
import { href } from 'react-router'
import { getSession } from '../lib/better-auth'
import type { Route } from './+types/org.$orgId.site.$siteId._index'

export async function loader({
    request,
    params: { orgId, siteId },
}: Route.LoaderArgs) {
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

    // Get the site and its branches
    const site = await prisma.site.findUnique({
        where: { siteId },
        include: {
            branches: {
                take: 1,
                orderBy: {
                    createdAt: 'asc',
                },
            },
        },
    })

    if (!site) {
        throw redirect(href('/org/:orgId/onboarding', { orgId }))
    }

    const branchId = site.branches[0]?.branchId
    if (!branchId) {
        throw redirect(href('/org/:orgId/onboarding', { orgId }))
    }

    // Find the first chat for this user in this branch, ordered by creation date (newest first)
    let chat = await prisma.chat.findFirst({
        where: {
            branchId,
            userId,
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    if (!chat) {
        // If no chat exists, create a new chat for this user in this branch
        chat = await prisma.chat.create({
            data: {
                userId,
                branchId,
                title: '',
            },
        })
    }

    // Redirect to the specific chat
    throw redirect(
        href('/org/:orgId/site/:siteId/chat/:chatId', {
            orgId,
            siteId,
            chatId: chat.chatId,
        }),
    )
}
