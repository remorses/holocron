// Credit economics for hosted AI chat usage. Pure — no I/O.
//
// Cost is computed from the EXACT token counts the AI SDK returns, times a
// hardcoded per-model USD rate table. This is the only viable approach: no
// Cloudflare runtime API returns real cost/neurons for @cf/ models (getLog is a
// dashboard log written minutes later, not a billing API), so the price has to
// live here. Credits are a user-facing layer over dollars; USD_PER_CREDIT is
// the only exchange-rate knob.

/** Real USD spend one credit represents. The only exchange-rate knob. */
export const USD_PER_CREDIT = 0.001

/** Free projects: 5,000 credits = $5/month. */
export const FREE_MONTHLY_CREDITS = 5_000

/** Subscribed (Pro) projects: 50,000 credits = $50/month, 10x the free tier. */
export const PRO_MONTHLY_CREDITS = 50_000

export const creditsToUsd = (credits: number): number => credits * USD_PER_CREDIT
export const usdToCredits = (usd: number): number => usd / USD_PER_CREDIT

/** The monthly credit budget for a project given its subscription state. */
export function monthlyCreditBudget(hasActiveSubscription: boolean): number {
  return hasActiveSubscription ? PRO_MONTHLY_CREDITS : FREE_MONTHLY_CREDITS
}

// Selectable Workers AI models: friendly name → `@cf/` model id passed to the
// binding. Kept next to the price table so a model and its rate live together.
export const ALLOWED_MODELS: Record<string, string> = {
  'gemma-4-26b': '@cf/google/gemma-4-26b-a4b-it',
  'glm-4.7-flash': '@cf/zai-org/glm-4.7-flash',
  'qwen3-30b': '@cf/qwen/qwen3-30b-a3b-fp8',
  'llama-3.1-8b': '@cf/meta/llama-3.1-8b-instruct-fast',
  'kimi-k2.5': '@cf/moonshotai/kimi-k2.5',
}

// Official Workers AI per-million-token USD rates, copied from
// developers.cloudflare.com/workers-ai/platform/pricing. Keyed by the
// ALLOWED_MODELS name in gateway.ts. A test asserts every selectable model has
// a rate here, so a model can never reach production without one.
//
// `cachedInput` is the (cheaper) cached-prompt rate where the model offers one;
// computeUsdCost charges cached tokens at it and the rest at `input`.
export const MODEL_USD_PER_1M_TOKENS: Record<string, { input: number; output: number; cachedInput?: number }> = {
  'glm-4.7-flash': { input: 0.06, output: 0.4 },
  'gemma-4-26b': { input: 0.1, output: 0.3 },
  'qwen3-30b': { input: 0.051, output: 0.335 },
  // CF's pricing page lists this rate under `@cf/meta/llama-3.1-8b-instruct-fp8-fast`;
  // gateway.ts selects `...-instruct-fast`, which is the same fp8-fast model (alias).
  'llama-3.1-8b': { input: 0.045, output: 0.384 },
  'kimi-k2.5': { input: 0.6, output: 3.0, cachedInput: 0.1 },
}

const DEFAULT_RATE = MODEL_USD_PER_1M_TOKENS['glm-4.7-flash']!

/** Exact USD cost for a request from its token counts and the model's rate.
 *  `cachedInputTokens` (a subset of `inputTokens`) is billed at the model's
 *  cheaper cached rate when it has one. Unknown models fall back to the glm
 *  rate — a test guarantees every selectable model is in the table, so this
 *  only ever applies to a genuine misconfiguration. */
export function computeUsdCost(
  model: string,
  tokens: { inputTokens: number; outputTokens: number; cachedInputTokens?: number },
): number {
  const rate = MODEL_USD_PER_1M_TOKENS[model] ?? DEFAULT_RATE
  const cached = Math.min(tokens.cachedInputTokens ?? 0, tokens.inputTokens)
  const uncachedInput = tokens.inputTokens - cached
  return (
    (uncachedInput / 1_000_000) * rate.input +
    (cached / 1_000_000) * (rate.cachedInput ?? rate.input) +
    (tokens.outputTokens / 1_000_000) * rate.output
  )
}
