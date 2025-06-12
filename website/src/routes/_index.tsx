import { href, redirect } from 'react-router'
import { Route } from '../+types/root'
import { getSession } from '../lib/better-auth'
import { prisma } from 'db'

export async function loader({ request }: Route.LoaderArgs) {
    const { userId, redirectTo } = await getSession({ request })
    if (redirectTo) {
        throw redirect(redirectTo)
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
    return redirect(href('/org/:orgId/onboarding', { orgId }))
}
