import type {
  Request as CFRequest,
  DurableObjectNamespace,
  ExecutionContext
} from '@cloudflare/workers-types'

// https://test-docs-basepath.holocronsites.com/docs
// https://fumabase-docs-prod-base-path-docs.fly.dev/docs

export default {
  async fetch(req: CFRequest, env: {}, ctx?: ExecutionContext): Promise<Response> {

    const url = new URL(req.url);
    const idDocsBasepathRegex = /^(.+)-docs-basepath\.holocronsites\.com$/;
    if (idDocsBasepathRegex.test(url.hostname)) {
      const newUrl = new URL(req.url);
      newUrl.hostname = 'fumabase-docs-prod-base-path-docs.fly.dev';
      newUrl.protocol = 'https:';
      // Clone headers so we can override the Host header
      const headers = new Headers(req.headers);
      headers.set('Host', url.hostname);
      const newReq = new Request(newUrl.toString(), {
        method: req.method,
        headers,
        body: req.body,
        redirect: req.redirect,
        // include other props from req if needed
      });
      return await fetch(newReq);
    }

    return await fetch(req)
  },
}
