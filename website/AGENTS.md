# website — holocron.so

The marketing site and AI gateway for holocron. Runs as a Cloudflare Worker with spiceflow.

## AI Gateway

The `/api/chat` route is Holocron's hosted AI chat interface. It validates optional `holo_xxx` API keys, fetches the caller's `docs.zip`, creates the in-memory docs bash tool, and streams typed Spiceflow SSE chunks back to docs sites.

All models are accessed via `@ai-sdk/gateway` (Vercel AI Gateway), which proxies requests to upstream providers (Moonshot, Anthropic, OpenAI, etc.) through one API key (`AI_GATEWAY_API_KEY`). `ai-fallback` wraps the primary model with fallbacks so if one provider is down, the next model is tried automatically.

Key references:
- Vercel AI Gateway: https://sdk.vercel.ai/docs/ai-gateway
- Vercel AI SDK: https://sdk.vercel.ai/docs
- ai-fallback: https://github.com/remorses/ai-fallback

## Supported models

Allowed models are defined in `src/lib/credits.ts` (`ALLOWED_MODELS`). Each entry maps a friendly name to a Vercel AI Gateway model id in `provider/model` format (e.g. `moonshotai/kimi-k2.5`). Kimi K2.5 is the primary model; Claude Sonnet 4 and GPT-4.1 Mini are fallbacks.

To add a new model:
1. Add its gateway id to `ALLOWED_MODELS` in `src/lib/credits.ts`
2. Add its per-million-token USD rate to `MODEL_USD_PER_1M_TOKENS` (the test asserts every model has a rate)
3. The model will automatically be included in the fallback chain

## Error tracking with strada

All runtime errors must be reported via `captureException` from `@strada.sh/sdk`, not swallowed with `console.error` or `console.warn`. The server app's `.onError` handler already captures uncaught route errors, but any error handled inline (like webhook failures, API call errors, etc.) must call `captureException(error, { tags: { ... } })` explicitly. Always include relevant tags like `route` and context-specific identifiers so errors are filterable in strada.

## Documentation command examples

Use `npx` for one-off command examples in MDX docs, like `npx vite` and `npx vite build`. It is more common and works regardless of whether the user installed dependencies with npm, pnpm, yarn, or bun.
