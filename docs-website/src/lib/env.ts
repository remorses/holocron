export const env = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    PUBLIC_URL: process.env.PUBLIC_URL,
    NEXT_PUBLIC_URL: process.env.PUBLIC_URL,
    DATABASE_URL: process.env.DATABASE_URL,
    SECRET: process.env.SECRET,
    SERVICE_SECRET: process.env.SERVICE_SECRET,
    GOOGLE_ID: process.env.GOOGLE_ID,
    GOOGLE_SECRET: process.env.GOOGLE_SECRET,

    GITHUB_APP_ID: process.env.GITHUB_APP_ID,
    GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    GITHUB_APP_NAME: process.env.GITHUB_APP_NAME,
    APPS_DOMAIN: process.env.APPS_DOMAIN,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_URL: process.env.R2_URL,
    UPLOADS_BASE_URL: process.env.UPLOADS_BASE_URL,
    TRIEVE_API_KEY: process.env.TRIEVE_API_KEY!,
    TRIEVE_ORGANIZATION_ID: process.env.TRIEVE_ORGANIZATION_ID!,
    CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
    CLOUDFLARE_ZONE_ID: process.env.CLOUDFLARE_ZONE_ID,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    // TRIEVE_ORGANIZATION_ID: process.env.TRIEVE_ORGANIZATION_ID,
    // TRIEVE_API_KEY: process.env.TRIEVE_API_KEY,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
}

// console.log(env)
for (let k in env) {
    if (
        env[k] == null &&
        (typeof window === 'undefined' || k.includes('PUBLIC'))
    ) {
        throw new Error(`Missing env var ${k}`)
    }
}

if (typeof window !== 'undefined') {
    // Attach env to window for browser usage
    ;(window as any).env = env
}

export const supportEmail = 'tommy@fumabase.com'
