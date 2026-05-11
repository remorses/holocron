// Catch-all route handler that forwards requests to the Holocron docs app.
// The Holocron app is built with base: '/docs' so it expects requests at /docs/*.
// No URL rewriting needed; Next.js routes /docs/* here and the full URL is forwarded.
// Static assets are served by spiceflow's auto-injected serveStatic middleware.

type HolocronModule = typeof import('example-basepath/dist/rsc')

let holocronPromise: Promise<HolocronModule> | undefined

function loadHolocron() {
  holocronPromise ??= import('example-basepath/dist/rsc') as Promise<HolocronModule>
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
