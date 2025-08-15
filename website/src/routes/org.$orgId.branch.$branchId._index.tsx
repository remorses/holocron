import { prisma } from 'db'
import { redirect } from 'react-router'
import { href } from 'react-router'
import { getSession } from '../lib/better-auth'
import type { Route } from './+types/org.$orgId.branch.$branchId._index'

export async function loader({
    request,
    params: { orgId, branchId },
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

    // Get the branch directly
    const branch = await prisma.siteBranch.findFirst({
        where: { 
            branchId,
            site: {
                org: {
                    users: {
                        some: { userId },
                    },
                },
            },
        },
        include: {
            site: true,
        },
    })

    if (!branch) {
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
        href('/org/:orgId/branch/:branchId/chat/:chatId', {
            orgId,
            branchId,
            chatId: chat.chatId,
        }),
    )
}
