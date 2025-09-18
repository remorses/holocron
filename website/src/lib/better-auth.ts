import { betterAuth } from 'better-auth'
import { bearer } from 'better-auth/plugins'
import { prisma } from 'db/'
import { stripe } from '@better-auth/stripe'
import { apiKey } from 'better-auth/plugins'
import Stripe from 'stripe'

import { prismaAdapter } from 'better-auth/adapters/prisma'
import { env } from './env'
import { notifyError } from './errors'

const stripeClient = new Stripe(env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-05-28.basil',
})

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  account: {
    modelName: 'Account',
    accountLinking: {
      enabled: true,
    },
  },
  onAPIError: {
    onError: (e, ctx) => notifyError(e, 'better-auth '),
  },
  advanced: {
    crossSubDomainCookies: { enabled: false },
    cookies: {
      session_token: {
        name: 'session_token',
        attributes: {
          httpOnly: false,
          path: '/',
          sameSite: 'Lax',
        },
      },
    },
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
  // emailAndPassword: {
  //     enabled: true,
  //     // sendEmailVerificationOnSignUp: true,
  //     async sendVerificationEmail() {
  //         console.log('Send email to verify email address')
  //     },
  //     async sendResetPassword(url, user) {
  //         console.log('Send email to reset password')
  //     },
  // },
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

  plugins: [
    bearer(),
    stripe({
      stripeClient: stripeClient as any,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: false,
    }),
    apiKey({
      // Store first 6 characters of API key for UI display
      startingCharactersConfig: {
        shouldStore: true,
        charactersLength: 6,
      },
      schema: {
        apikey: { modelName: 'ApiKey' },
      },
      // Default key settings
      defaultKeyLength: 64,
      defaultPrefix: 'holocron_', // Prefix to identify holocron API keys
      // Rate limiting defaults
      rateLimit: {
        enabled: true,
        timeWindow: 1000 * 60 * 60 * 24, // 24 hours
        maxRequests: 1000, // 1000 requests per day by default
      },
      // Enable metadata for storing custom data with API keys
      enableMetadata: true,
      // API keys can act as session replacements
      disableSessionForAPIKeys: false,
    }),
  ],
})

export async function getSession({ request }) {
  const headers = new Headers()
  const data = await auth.api.getSession({ headers: request.headers }).catch(() => null)
  if (!data) {
    return { userId: '', headers, redirectTo: '/login', user: null }
  }
  const { session, user } = data
  const { id: userId, email, emailVerified, name, image } = user
  return { userId, email, headers, redirectTo: undefined, ...data }
}
