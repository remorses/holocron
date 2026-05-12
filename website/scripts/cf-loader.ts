// ESM resolve hook that stubs `cloudflare:workers` so we can import the
// app in a plain Node/tsx environment (for openapi generation, etc.).
// The stub returns an empty `env` proxy; handlers are never called, only
// route metadata (schemas, paths) is read by the openapi plugin.

export function resolve(
  specifier: string,
  context: { parentURL?: string },
  next: Function,
) {
  if (specifier === 'cloudflare:workers') {
    return {
      url: 'data:text/javascript,export const env = new Proxy({}, { get: () => undefined }); export function waitUntil() {}; export class DurableObject {}',
      shortCircuit: true,
    }
  }
  return next(specifier, context)
}
