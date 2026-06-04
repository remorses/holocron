// Minimal ambient declarations for cloudflare:workers so the db package
// typechecks without pulling in the full wrangler types. The website
// package has the real types via wrangler; this just satisfies tsc here.

interface D1Result<T = unknown> { results: T[]; success: boolean; meta: unknown }
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  all<T = unknown>(): Promise<D1Result<T>>
  run(): Promise<D1Result>
}
interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

declare module 'cloudflare:workers' {
  const env: {
    DB: D1Database
    [key: string]: unknown
  }
  export { env }
}
