// Unit tests for the credit/USD abstraction. Pure functions, no CF runtime —
// verifies the exchange-rate math, the free/pro budgets, and the exact
// per-model token cost computation.
import { describe, test, expect } from 'vitest'
import {
  USD_PER_CREDIT,
  FREE_MONTHLY_CREDITS,
  PRO_MONTHLY_CREDITS,
  ALLOWED_MODELS,
  MODEL_USD_PER_1M_TOKENS,
  creditsToUsd,
  usdToCredits,
  monthlyCreditBudget,
  computeUsdCost,
} from './credits.ts'

describe('credit ↔ usd conversion', () => {
  test('round-trips', () => {
    expect(creditsToUsd(1000)).toMatchInlineSnapshot(`1`)
    expect(usdToCredits(1)).toMatchInlineSnapshot(`1000`)
    expect(usdToCredits(creditsToUsd(5000))).toBe(5000)
  })
})

describe('monthly budgets', () => {
  test('free vs pro', () => {
    expect(monthlyCreditBudget(false)).toBe(FREE_MONTHLY_CREDITS)
    expect(monthlyCreditBudget(true)).toBe(PRO_MONTHLY_CREDITS)
    expect(PRO_MONTHLY_CREDITS).toBeGreaterThan(FREE_MONTHLY_CREDITS)
  })

  test('free budget in dollars', () => {
    expect(creditsToUsd(FREE_MONTHLY_CREDITS)).toMatchInlineSnapshot(`5`)
  })

  test('exchange rate is the single knob', () => {
    expect(USD_PER_CREDIT).toMatchInlineSnapshot(`0.001`)
  })
})

describe('computeUsdCost — exact tokens × per-model rate', () => {
  test('kimi default model: 1M in + 1M out', () => {
    // kimi = $0.60 input + $3.00 output per 1M tokens.
    expect(computeUsdCost('kimi-k2.5', { inputTokens: 1_000_000, outputTokens: 1_000_000 })).toBeCloseTo(3.6, 10)
  })

  test('realistic small request', () => {
    expect(computeUsdCost('kimi-k2.5', { inputTokens: 3000, outputTokens: 500 })).toMatchInlineSnapshot(`0.0033`)
  })

  test('unknown model falls back to default rate', () => {
    const known = computeUsdCost('kimi-k2.5', { inputTokens: 1234, outputTokens: 567 })
    expect(computeUsdCost('not-a-real-model', { inputTokens: 1234, outputTokens: 567 })).toBe(known)
  })

  test('cached input tokens billed at the cheaper cached rate', () => {
    // kimi: 1M input of which 1M cached, at $0.10 cached vs $0.60 normal.
    const allCached = computeUsdCost('kimi-k2.5', { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 1_000_000 })
    expect(allCached).toBeCloseTo(0.1, 10)
    // Half cached: 0.5M × $0.60 + 0.5M × $0.10 = $0.35.
    const halfCached = computeUsdCost('kimi-k2.5', { inputTokens: 1_000_000, outputTokens: 0, cachedInputTokens: 500_000 })
    expect(halfCached).toBeCloseTo(0.35, 10)
  })

  test('every selectable model (ALLOWED_MODELS) has a rate', () => {
    for (const name of Object.keys(ALLOWED_MODELS)) {
      expect(MODEL_USD_PER_1M_TOKENS[name], name).toBeDefined()
    }
  })

  test('every rate is sane', () => {
    for (const [name, rate] of Object.entries(MODEL_USD_PER_1M_TOKENS)) {
      expect(rate.input, name).toBeGreaterThan(0)
      expect(rate.output, name).toBeGreaterThan(0)
      if (rate.cachedInput !== undefined) expect(rate.cachedInput, name).toBeLessThanOrEqual(rate.input)
    }
  })
})
