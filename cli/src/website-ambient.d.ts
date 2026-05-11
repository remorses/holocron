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
