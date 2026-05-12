// Ambient declarations so tsc can resolve type-only imports from
// website/src/ without pulling in wrangler or Cloudflare types.
// Only needed because cli imports `type { App }` from the website
// source and tsc walks the full transitive import graph.

declare module 'cloudflare:workers' {
  const env: any
  const waitUntil: any
  class DurableObject<E = any> {
    ctx: any
    env: E
    constructor(ctx: any, env: E)
  }
  export { env, waitUntil, DurableObject }
}

declare module '*.css' {}

// Cloudflare Workers globals used by website/src/ transitive imports
type ExportedHandler = any
type DurableObjectStub<T = any> = T & { id: any; name?: string }
type DurableObjectState = { storage: any; id: any; [k: string]: any }
type Env = Record<string, any>

// @holocron.so/vite subpaths used by website/src/server.tsx.
// The actual types come from vite's dist/ but cli doesn't need them.
declare module '@holocron.so/vite/app' {
  const app: any
  export { app }
}

declare module '@holocron.so/vite/src/schema.json' {
  const schema: any
  export default schema
}
