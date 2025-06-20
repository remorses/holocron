import { href, redirect } from 'react-router'
import { auth, getSession } from '../lib/better-auth'
import { prisma } from 'db'

export async function loader({ request }) {
    const { userId } = await getSession({ request })
    if (!userId) {
        const res = await auth.api.signInSocial({
            body: {
                provider: 'google',
                callbackURL: '/',
            },
        })
        if (!res.url) {
            throw new Error('No URL returned from signInSocial')
        }
        throw redirect(res.url)
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
    const site = await prisma.site.findFirst({
        where: {
            orgId,
        },
        orderBy: {
            createdAt: 'desc',
        },
        include: {
            chats: {
                orderBy: { createdAt: 'desc' },
                select: { chatId: true },
            },
        },
    })
    if (!site) {
        return redirect(href('/org/:orgId/onboarding', { orgId }))
    }
    const siteId = site.siteId
    const chatId = site.chats[0]?.chatId || ''
    if (!chatId) {
        return redirect(href('/org/:orgId/onboarding', { orgId }))
    }
    return redirect(
        href('/org/:orgId/site/:siteId/chat/:chatId', {
            orgId,
            siteId,
            chatId,
        }),
    )
}
