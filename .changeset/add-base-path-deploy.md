---
'@holocron.so/cli': minor
'@holocron.so/vite': minor
---

Add `--base-path` flag to `holocron deploy` for subpath hosting.

Deploy your docs at a subpath on your own domain (e.g. `yoursite.com/docs`) instead of a separate subdomain. The flag sets Vite's `base` option at build time so all routes and assets are prefixed under the given path.

```bash
npx -y @holocron.so/cli deploy --base-path /docs
```

Then configure a rewrite or reverse proxy in your framework (Next.js, Vercel, Cloudflare Workers, Nginx, Express) to forward `/docs/*` requests to the deployed holocron.so URL.

Subpath hosting requires a Holocron Pro subscription. The hosting worker strips the base path prefix before looking up assets in the manifest, so both root and subpath deploys work with the same content-addressable storage.
