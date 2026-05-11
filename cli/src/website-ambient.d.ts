// Ambient declarations so tsc can resolve type-only imports from
// website/src/ without pulling in wrangler or Cloudflare types.
// Only needed because cli imports `type { App }` from the website
// source and tsc walks the full transitive import graph.

declare module 'cloudflare:workers' {
  const env: any
  export { env }
}

declare module '*.css' {}

// Cloudflare Workers global
type ExportedHandler = any

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
