// Ambient module shim for the built website app type used by the CLI fetch client.
// The website package build does not emit declaration files on this branch.

declare module 'website/dist/src/server.d.ts' {
  export type App = any
}
