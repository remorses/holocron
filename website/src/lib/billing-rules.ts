// Pure billing decision functions — no I/O, no Stripe, no DB.
//
// All subscription gating logic lives here as pure functions so the rules are
// trivial to reason about and the callers (deploy-api.ts, gateway.ts) only have
// to fetch state and apply the decision. Keeping the policy in one place avoids
// scattering "is this allowed?" checks across the codebase.

export const PRO_PRICE_LOOKUP_KEYS = {
  monthly: 'pro_monthly',
  yearly: 'pro_yearly',
} as const

export type BillingInterval = keyof typeof PRO_PRICE_LOOKUP_KEYS

/** Stripe statuses that count as "the project is paid and active". past_due is
 *  included so a failed renewal doesn't instantly lock a customer out while
 *  Stripe retries the charge. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing', 'past_due'] as const

/** Free projects get exactly ONE production deployment. Previews always require
 *  a subscription. */
export const FREE_PRODUCTION_DEPLOY_LIMIT = 1

export type DeployDecision =
  | { allowed: true }
  | { allowed: false; code: 'SUBSCRIPTION_REQUIRED'; reason: string }

/** Decide whether a deployment is allowed given the project's billing state.
 *
 *  - Subscribed projects: always allowed.
 *  - Preview deploys (PR/branch): require a subscription.
 *  - Production deploys: the first is free; subsequent ones require a
 *    subscription. `isRefinalizeOfActive` is true when re-finalizing the
 *    deployment that is already live, which must never be blocked. */
export function canDeploy(opts: {
  isPreview: boolean
  hasActiveSubscription: boolean
  productionDeployCount: number
  isRefinalizeOfActive: boolean
  hasBasePath?: boolean
}): DeployDecision {
  if (opts.hasActiveSubscription) return { allowed: true }
  if (opts.isRefinalizeOfActive) return { allowed: true }

  if (opts.hasBasePath) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_REQUIRED',
      reason: 'Base path deployments require a Holocron Pro subscription. Deploy with --base-path to host docs at a subpath like /docs on your domain.',
    }
  }

  if (opts.isPreview) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_REQUIRED',
      reason: 'Preview deployments require a Holocron Pro subscription.',
    }
  }

  if (opts.productionDeployCount >= FREE_PRODUCTION_DEPLOY_LIMIT) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_REQUIRED',
      reason: `Free projects are limited to ${FREE_PRODUCTION_DEPLOY_LIMIT} production deployment. Subscribe to Holocron Pro for unlimited preview deployments.`,
    }
  }

  return { allowed: true }
}

/** Custom domains require an active subscription because they cost money
 *  (Cloudflare SSL for SaaS per-hostname charges). */
export function canAddDomain(opts: {
  hasActiveSubscription: boolean
}): DeployDecision {
  if (opts.hasActiveSubscription) return { allowed: true }
  return {
    allowed: false,
    code: 'SUBSCRIPTION_REQUIRED',
    reason: 'Custom domains require a Holocron Pro subscription.',
  }
}

/** The AI chat shows a "temporary model" nag to push users toward a paid plan.
 *  Subscribed projects never see it. Unauthenticated callers (no API key) still
 *  see it because they have no project to bill. */
export function shouldShowTempAiNotice(opts: {
  authenticated: boolean
  hasActiveSubscription: boolean
}): boolean {
  if (opts.hasActiveSubscription) return false
  return !opts.authenticated
}
