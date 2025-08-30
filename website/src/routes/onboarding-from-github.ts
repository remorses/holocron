import { href, redirect } from 'react-router'
import { getSession } from '../lib/better-auth'
import { prisma } from 'db'
import type { Route } from './+types/onboarding-from-github'

export async function loader({ request }: Route.LoaderArgs) {
    const { userId } = await getSession({ request })
    const url = new URL(request.url)
    
    if (!userId) {
        const loginUrl = new URL(
            href('/login'),
            process.env.PUBLIC_URL
        )
        loginUrl.searchParams.set('callbackUrl', href('/onboarding-from-github'))
        
        const existingParams = url.searchParams
        existingParams.forEach((value, key) => {
            if (key !== 'callbackUrl') {
                loginUrl.searchParams.set(key, value)
            }
        })
        
        throw redirect(loginUrl.pathname + loginUrl.search)
    }
    
    const org = await prisma.org.findFirst({
        where: {
            users: {
                some: {
                    userId,
                },
            },
        },
    })
    
    if (!org) {
        const loginUrl = new URL(href('/login'), process.env.PUBLIC_URL)
        loginUrl.searchParams.set('callbackUrl', href('/onboarding-from-github'))
        throw redirect(loginUrl.pathname + loginUrl.search)
    }
    
    const orgId = org.orgId
    
    throw redirect(
        href('/org/:orgId/onboarding-from-github', { orgId }) + url.search
    )
}