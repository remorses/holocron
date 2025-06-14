import { betterAuth } from 'better-auth'
import { prisma } from 'db/'

import { prismaAdapter } from 'better-auth/adapters/prisma'
import { env } from './env'

export const auth = betterAuth({
    database: prismaAdapter(prisma, {
        provider: 'postgresql',
    }),
    account: {
        modelName: 'Account',
    },
    user: {
        modelName: 'User',
    },
    verification: {
        modelName: 'Verification',
    },
    session: {
        modelName: 'Session',
    },
    secret: env.SECRET,
    logger: console,

    baseURL: env.NEXT_PUBLIC_URL?.toString() ?? '',
    emailAndPassword: {
        enabled: true,
        sendEmailVerificationOnSignUp: true,
        async sendVerificationEmail() {
            console.log('Send email to verify email address')
        },
        async sendResetPassword(url, user) {
            console.log('Send email to reset password')
        },
    },
    // advanced: {
    //     crossSubDomainCookies: { enabled: false },
    // },
    socialProviders: {
        google: {
            clientId: env.GOOGLE_ID || '',
            clientSecret: env.GOOGLE_SECRET || '',
            prompt: 'consent',
        },
        // github: {
        //     clientId: process.env.GITHUB_CLIENT_ID || '',
        //     clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
        // },
        // discord: {
        //     clientId: process.env.DISCORD_CLIENT_ID || '',
        //     clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
        // },
    },
})

export async function getSession({ request }) {
    const headers = new Headers()
    const data = await auth.api.getSession({ headers: request.headers })
    if (!data) {
        return { userId: '', headers, redirectTo: '/login' }
    }
    const { session, user } = data
    const { id: userId, email, emailVerified, name, image } = user
    return { userId, email, headers, ...data }
}
