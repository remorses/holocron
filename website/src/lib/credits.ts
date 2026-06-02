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

// Official Workers AI per-million-token USD rates, copied from
// developers.cloudflare.com/workers-ai/platform/pricing. Keyed by the
// ALLOWED_MODELS name in gateway.ts. When you add a model there, add its rate
// here too — computeUsdCost falls back to the glm rate and logs if it's missing.
export const MODEL_USD_PER_1M_TOKENS: Record<string, { input: number; output: number }> = {
  'glm-4.7-flash': { input: 0.06, output: 0.4 },
  'gemma-4-26b': { input: 0.1, output: 0.3 },
  'qwen3-30b': { input: 0.051, output: 0.335 },
  'llama-3.1-8b': { input: 0.045, output: 0.384 },
  'kimi-k2.5': { input: 0.6, output: 3.0 },
}

const DEFAULT_RATE = MODEL_USD_PER_1M_TOKENS['glm-4.7-flash']!

/** Exact USD cost for a request from its token counts and the model's rate. */
export function computeUsdCost(
  model: string,
  tokens: { inputTokens: number; outputTokens: number },
): number {
  const rate = MODEL_USD_PER_1M_TOKENS[model] ?? DEFAULT_RATE
  return (tokens.inputTokens / 1_000_000) * rate.input + (tokens.outputTokens / 1_000_000) * rate.output
}
