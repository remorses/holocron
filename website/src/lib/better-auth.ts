import { betterAuth } from 'better-auth'
import { prisma } from 'db/'

import { twoFactor } from 'better-auth/plugins'
import { env } from './env'

export const auth = betterAuth({
    database: prisma,

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
    socialProviders: {
        google: {
            clientId: process.env.GOOGLE_CLIENT_ID || '',
            // prompt: 'consent',

            clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
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

export async function getSupabaseSession({ request }) {
    const headers = new Headers()
    const data = await auth.api.getSession({  headers: request.headers })
    if (!data) {
        return { userId: '', headers, redirectTo: '/login' }
    }
    const { session, user } = data
    const { id: userId, email, emailVerified, name, image } = user
    return { userId, email, headers, ...data }
}
