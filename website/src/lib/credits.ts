// Credit economics for hosted AI chat usage. Pure — no I/O.
//
// Cost is computed from the EXACT token counts the AI SDK returns, times a
// hardcoded per-model USD rate table. Credits are a user-facing layer over
// dollars; USD_PER_CREDIT is the only exchange-rate knob.
//
// Models are accessed via @ai-sdk/gateway (Vercel AI Gateway) which proxies to
// the upstream provider. The gateway model id format is "provider/model-name"
// (e.g. "moonshotai/kimi-k2.5"). ai-fallback wraps multiple gateway models so
// if the primary is down we automatically try the next one.

/** Real USD spend one credit represents. The only exchange-rate knob. */
export const USD_PER_CREDIT = 0.001

/** Free projects: 5,000 credits = $5/month. */
export const FREE_MONTHLY_CREDITS = 5_000

/** Subscribed (Pro) projects: 50,000 credits = $50/month, 10x the free tier. */
export const PRO_MONTHLY_CREDITS = 50_000

export const creditsToUsd = (credits: number): number => credits * USD_PER_CREDIT
export const usdToCredits = (usd: number): number => usd / USD_PER_CREDIT

/** The monthly credit budget for a project given its billing state.
 *  Partner orgs get Pro budget without a Stripe subscription. */
export function monthlyCreditBudget(opts: {
  hasActiveSubscription: boolean
  isPartner?: boolean
}): number {
  if (opts.hasActiveSubscription || opts.isPartner) return PRO_MONTHLY_CREDITS
  return FREE_MONTHLY_CREDITS
}

// Selectable models: friendly name → gateway model id (provider/model format).
// Kept next to the price table so a model and its rate live together.
// All models are accessed via @ai-sdk/gateway (Vercel AI Gateway).
// Order matters: the first entry is the primary model, the rest are fallbacks
// tried in order by ai-fallback when the primary errors.
export const ALLOWED_MODELS: Record<string, string> = {
  'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
  'kimi-k2.5': 'moonshotai/kimi-k2.5',
  'gpt-4.1-mini': 'openai/gpt-4.1-mini',
  'claude-sonnet-4': 'anthropic/claude-sonnet-4-20250514',
}

// Per-million-token USD rates for each model. Keyed by the ALLOWED_MODELS
// friendly name. A test asserts every selectable model has a rate here, so a
// model can never reach production without one.
//
// `cachedInput` is the (cheaper) cached-prompt rate where the model offers one;
// computeUsdCost charges cached tokens at it and the rest at `input`.
export const MODEL_USD_PER_1M_TOKENS: Record<string, { input: number; output: number; cachedInput?: number }> = {
  'deepseek-v4-flash': { input: 0.2, output: 0.6, cachedInput: 0.05 },
  'kimi-k2.5': { input: 0.6, output: 3.0, cachedInput: 0.1 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6, cachedInput: 0.1 },
  'claude-sonnet-4': { input: 3.0, output: 15.0, cachedInput: 0.3 },
}

const DEFAULT_RATE = MODEL_USD_PER_1M_TOKENS['deepseek-v4-flash']!

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
