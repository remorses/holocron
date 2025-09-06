import {
  createRequestHandler,
  unstable_createContext,
  unstable_RouterContextProvider,
} from 'react-router'
import { R2Bucket } from '@cloudflare/workers-types'

declare global {
  interface Env {
    UPLOADS_BUCKET: R2Bucket
  }
  // export interface Request extends CloudflareRequest {}

  interface CloudflareEnvironment extends Env {}
}

interface ExecutionContext {}

const cloudflareContext = unstable_createContext<{
  env: CloudflareEnvironment
  ctx: ExecutionContext
}>()

declare module 'react-router' {
  export interface unstable_RouterContextProvider {
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
  async fetch(request: any, env: any, ctx: any) {
    const contextProvider = new unstable_RouterContextProvider()
    contextProvider.set(cloudflareContext, { env, ctx })
    Object.assign(contextProvider, { cloudflare: { env, ctx } })
    return requestHandler(request, contextProvider)
  },
}
