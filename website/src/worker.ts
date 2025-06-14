import { createRequestHandler } from 'react-router'

declare global {
    interface Env {}
    interface CloudflareEnvironment extends Env {}
}

interface ExecutionContext {}

declare module 'react-router' {
    export interface AppLoadContext {
        cloudflare: {
            env: CloudflareEnvironment
            ctx: ExecutionContext
        }
    }
}

const requestHandler = createRequestHandler(
    () => import('virtual:react-router/server-build'),
    import.meta.env.MODE,
)

export default {
    async fetch(request, env, ctx) {
        return requestHandler(request, {
            cloudflare: { env, ctx },
        })
    },
}
