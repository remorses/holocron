// Catch-all route handler that forwards requests to the Holocron docs app.
// The Holocron app is built with base: '/docs' so it expects requests at /docs/*.
// No URL rewriting needed; Next.js routes /docs/* here and the full URL is forwarded.
// Static assets are served by spiceflow's auto-injected serveStatic middleware.
//
// The dynamic import with turbopackIgnore/webpackIgnore tells the bundler to
// skip this import entirely. The pre-built holocron output contains patterns
// (native NAPI loaders, vite RSC internals) that bundlers can't re-process.
// Node.js resolves the import at runtime instead, which is the correct behavior
// for a pre-built server artifact.

type HolocronModule = typeof import('example-basepath/dist/rsc')

let holocronPromise: Promise<HolocronModule> | undefined

function loadHolocron() {
  holocronPromise ??= import(
    /* webpackIgnore: true */
    /* turbopackIgnore: true */
    'example-basepath/dist/rsc'
  ) as Promise<HolocronModule>
  return holocronPromise
}

async function handler(request: Request) {
  const { app } = await loadHolocron()
  return app.handle(request)
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
export const HEAD = handler
export const OPTIONS = handler
