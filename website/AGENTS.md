# website — holocron.so

The marketing site and AI gateway for holocron. Runs as a Cloudflare Worker with spiceflow.

## AI Gateway

The `/api/holocron/chat` route is Holocron's hosted AI chat interface. It validates optional `holo_xxx` API keys, fetches the caller's `docs.zip`, creates the in-memory docs bash tool, calls AI SDK against Cloudflare Workers AI, and streams typed Spiceflow SSE chunks back to docs sites.

Full CF AI Gateway docs: `curl https://developers.cloudflare.com/ai-gateway/llms-full.txt`
Full CF Workers AI docs: `curl https://developers.cloudflare.com/workers-ai/llms-full.txt`

Key references:
- Workers AI binding: https://developers.cloudflare.com/ai-gateway/integrations/aig-workers-ai-binding/
- Worker binding methods (getLog, patchLog, getUrl): https://developers.cloudflare.com/ai-gateway/integrations/worker-binding-methods/
- Custom metadata: https://developers.cloudflare.com/ai-gateway/observability/custom-metadata/
- Logging: https://developers.cloudflare.com/ai-gateway/observability/logging/
- Analytics (GraphQL): https://developers.cloudflare.com/ai-gateway/observability/analytics/
- Workers AI models catalog: https://developers.cloudflare.com/workers-ai/models/
- Workers AI get started: https://developers.cloudflare.com/workers-ai/get-started/workers-wrangler/

## Supported models

Allowed models are defined in `src/gateway.ts` (`ALLOWED_MODELS`). GLM 4.7 Flash is both the authenticated default and the missing-key temporary fallback. To add a new model, add its `@cf/` ID to the map.

## Documentation command examples

Use `npx` for one-off command examples in MDX docs, like `npx vite` and `npx vite build`. It is more common and works regardless of whether the user installed dependencies with npm, pnpm, yarn, or bun.
