// Credit economics for hosted AI chat usage. Pure — no I/O.
//
// Cost is computed from the EXACT token counts the AI SDK returns, times a
// hardcoded per-model USD rate table. Credits are a user-facing layer over
// dollars; USD_PER_CREDIT is the only exchange-rate knob.
//
// Models live in `./ai-models.ts` (shared with Maintain). Credits wrap those
// rates as the user-facing dollar layer.

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

import { DEFAULT_MODEL, MODEL_USD_PER_1M_TOKENS } from './ai-models.ts'

export { ALLOWED_MODELS, DEFAULT_MODEL, MODEL_USD_PER_1M_TOKENS } from './ai-models.ts'

const DEFAULT_RATE = MODEL_USD_PER_1M_TOKENS[DEFAULT_MODEL]!

/** Exact USD cost for a request from its token counts and the model's rate.
 *  `cachedInputTokens` (a subset of `inputTokens`) is billed at the model's
 *  cheaper cached rate when it has one. Unknown models fall back to the
 *  default model rate. A test guarantees every selectable model is in the table. */
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
