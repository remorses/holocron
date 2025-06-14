import { createRequestHandler } from 'react-router'
import {
    R2Bucket,
    Request as CloudflareRequest,
} from '@cloudflare/workers-types'

declare global {
    interface Env {
        UPLOADS_BUCKET: R2Bucket
    }
    // export interface Request extends CloudflareRequest {}

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
