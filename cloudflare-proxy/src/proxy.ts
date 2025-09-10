
import type {
  Request as CFRequest,
  DurableObjectNamespace,
  ExecutionContext
} from '@cloudflare/workers-types'

// https://test-docs-basepath.holocronsites.com/docs
// https://fumabase-docs-prod-base-path-docs.fly.dev/docs



// Holocron domains handling:
// all production customers sites are avaiable in *.holocronsites.com
// preview database environment sites are available in *.preview-site.holocronsites.com and deployed in a separate Fly machine
//
// sites are also available with a /docs base path.
// all production customers sites with base path /docs are available in {branchId}-docs-basepath.holocronsites.com
// preview database sites with base path /docs are available in {branchId}-preview-docs-basepath.holocronsites.com



export default {
  async fetch(req: CFRequest, env: {}, ctx?: ExecutionContext): Promise<Response> {

    const url = new URL(req.url);
    const idDocsBasepathRegex = /^(.+)-docs-basepath\.holocronsites\.com$/;
    const idDocsBasepathMatch = url.hostname.match(idDocsBasepathRegex);
    if (idDocsBasepathMatch) {
      const prefix = idDocsBasepathMatch[1];
      const newUrl = new URL(req.url);

      if (prefix.endsWith('preview')) {
        newUrl.hostname = 'fumabase-docs-preview-base-path-docs.fly.dev';
      } else {
        newUrl.hostname = 'fumabase-docs-prod-base-path-docs.fly.dev';
      }
      newUrl.protocol = 'https:';
      // Clone headers so we can override the Host header and add a forwarder header
      const headers = new Headers(req.headers);
      headers.set('Host', url.hostname);
      headers.set('x-forwarded-host', url.hostname);
      const newReq = new Request(newUrl.toString(), {
        method: req.method,
        headers,
        body: req.body,
        redirect: req.redirect,
        // include other props from req if needed
      });
      return await fetch(newReq);
    }

    const previewSiteRegex = /^(.+)-preview-site\.holocronsites\.com$/;
    if (previewSiteRegex.test(url.hostname)) {
      const newUrl = new URL(req.url);
      newUrl.hostname = 'fumabase-docs-preview.fly.dev';
      newUrl.protocol = 'https:';
      const headers = new Headers(req.headers);
      headers.set('Host', url.hostname);
      headers.set('x-forwarded-host', url.hostname);
      const newReq = new Request(newUrl.toString(), {
        method: req.method,
        headers,
        body: req.body,
        redirect: req.redirect,
      });
      return await fetch(newReq);
    }

    return await fetch(req)
  },
}
