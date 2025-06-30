import { href, redirect } from 'react-router'
import { auth, getSession } from '../lib/better-auth'
import { prisma } from 'db'

export async function loader({ request }) {
    const { userId } = await getSession({ request })
    const url = new URL(request.url)
    const callbackUrl = url.searchParams.get('callbackUrl') || ''
    const fullCallbackUrl = new URL(
        callbackUrl,
        process.env.PUBLIC_URL,
    ).toString()
    if (!userId) {
        const res = await auth.api.signInSocial({
            body: {
                provider: 'google',
                callbackURL: fullCallbackUrl,
            },

        })
        if (!res.url) {
            throw new Error('No URL returned from signInSocial')
        }
        throw redirect(res.url)
    }
    if (callbackUrl) {
        throw redirect(fullCallbackUrl)
    }
    let org = await prisma.org.findFirst({
        where: {
            users: {
                some: {
                    userId,
                },
            },
        },
    })
    if (!org) {
        org = await prisma.org.create({
            data: {
                orgId: userId,
                name: 'Default',
                users: {
                    create: {
                        userId,
                        role: 'ADMIN',
                    },
                },
            },
        })
    }
    const orgId = org?.orgId || ''
    // Use one Prisma query to fetch latest site, its latest branch, and the user's latest chat for that org
    const site = await prisma.site.findFirst({
        where: {
            orgId,
        },
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            branches: {
                take: 1,
                orderBy: {
                    createdAt: 'desc',
                },
            },
            // Nested: Find the latest chat for this user in the latest branch of this site
            // Since Prisma does not support skipping one-to-many limits with nested filters directly,
            // we'll fetch chats at the site level filtering down after.
            // But we can include an array of chats for this user, ordered, and pick the latest in code.
            // So, include branches and for each branch, include chats in order for that user:
            // But since site -> branches is many, let's just find latest branch and use that for chat lookup.
        },
    })

    if (!site) {
        return redirect(href('/org/:orgId/onboarding', { orgId }))
    }
    const siteId = site.siteId
    const latestBranch = site.branches[0]
    if (!latestBranch) {
        return redirect(href('/org/:orgId/onboarding', { orgId }))
    }

    // Now find latest chat for that user on that branch (this is an extra DB call, but still just one in this block):
    const chat = await prisma.chat.findFirst({
        where: {
            userId,
            branchId: latestBranch.branchId,
        },
        orderBy: { createdAt: 'desc' },
        select: { chatId: true },
    })

    let chatId = chat?.chatId || ''
    if (!chatId) {
        // Create a new chat for the user on the latest branch
        const newChat = await prisma.chat.create({
            data: {
                userId,
                branchId: latestBranch.branchId,
                title: 'New Chat',
            },
            select: { chatId: true },
        })
        chatId = newChat.chatId
    }
    return redirect(
        href('/org/:orgId/site/:siteId/chat/:chatId', {
            orgId,
            siteId,
            chatId,
        }),
    )
}
