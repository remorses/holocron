// Unit tests for pure billing decision functions (no DB / Stripe).
import { describe, expect, test } from 'vitest'
import {
  canAddDomain,
  canDeploy,
  FREE_PRODUCTION_DEPLOY_LIMIT,
  hasDeployEntitlement,
  shouldShowHolocronPromotion,
  subscriptionRequiredPayload,
} from './billing-rules.ts'

describe('hasDeployEntitlement', () => {
  test('partner org is entitled without subscription', () => {
    expect(hasDeployEntitlement({ hasActiveSubscription: false, orgPlan: 'partner' })).toBe(true)
  })
  test('active subscription is entitled', () => {
    expect(hasDeployEntitlement({ hasActiveSubscription: true, orgPlan: 'free' })).toBe(true)
  })
  test('free org without subscription is not entitled', () => {
    expect(hasDeployEntitlement({ hasActiveSubscription: false, orgPlan: 'free' })).toBe(false)
  })
})

describe('canDeploy', () => {
  test('partner allows second production deploy', () => {
    const decision = canDeploy({
      isPreview: false,
      hasActiveSubscription: false,
      productionDeployCount: FREE_PRODUCTION_DEPLOY_LIMIT,
      isRefinalizeOfActive: false,
      orgPlan: 'partner',
    })
    expect(decision).toEqual({ allowed: true })
  })

  test('partner allows preview and base-path', () => {
    expect(canDeploy({
      isPreview: true,
      hasActiveSubscription: false,
      productionDeployCount: 0,
      isRefinalizeOfActive: false,
      orgPlan: 'partner',
    }).allowed).toBe(true)

    expect(canDeploy({
      isPreview: false,
      hasActiveSubscription: false,
      productionDeployCount: 0,
      isRefinalizeOfActive: false,
      hasBasePath: true,
      orgPlan: 'partner',
    }).allowed).toBe(true)
  })

  test('free blocks second production deploy', () => {
    const decision = canDeploy({
      isPreview: false,
      hasActiveSubscription: false,
      productionDeployCount: FREE_PRODUCTION_DEPLOY_LIMIT,
      isRefinalizeOfActive: false,
      orgPlan: 'free',
    })
    expect(decision.allowed).toBe(false)
    if (!decision.allowed) expect(decision.code).toBe('SUBSCRIPTION_REQUIRED')
  })

  test('free allows first production deploy', () => {
    expect(canDeploy({
      isPreview: false,
      hasActiveSubscription: false,
      productionDeployCount: 0,
      isRefinalizeOfActive: false,
    }).allowed).toBe(true)
  })

  test('free blocks preview', () => {
    const decision = canDeploy({
      isPreview: true,
      hasActiveSubscription: false,
      productionDeployCount: 0,
      isRefinalizeOfActive: false,
    })
    expect(decision.allowed).toBe(false)
  })
})

describe('canAddDomain', () => {
  test('partner can add domain without subscription', () => {
    expect(canAddDomain({ hasActiveSubscription: false, orgPlan: 'partner' })).toEqual({ allowed: true })
  })

  test('free cannot add domain without subscription', () => {
    const decision = canAddDomain({ hasActiveSubscription: false, orgPlan: 'free' })
    expect(decision.allowed).toBe(false)
  })
})

describe('shouldShowHolocronPromotion', () => {
  test('partner never sees the promotion', () => {
    expect(shouldShowHolocronPromotion({
      hasActiveSubscription: false,
      orgPlan: 'partner',
    })).toBe(false)
  })

  test('subscribed projects never see the promotion', () => {
    expect(shouldShowHolocronPromotion({
      hasActiveSubscription: true,
    })).toBe(false)
  })

  test('unauthenticated sites show the promotion', () => {
    expect(shouldShowHolocronPromotion({
      hasActiveSubscription: false,
    })).toBe(true)
  })

  test('free projects show the promotion', () => {
    expect(shouldShowHolocronPromotion({
      hasActiveSubscription: false,
      orgPlan: 'free',
    })).toBe(true)
  })
})

describe('subscriptionRequiredPayload', () => {
  test('includes subscribe command and billing URL', () => {
    expect(subscriptionRequiredPayload({
      reason: 'This project is on the free plan. Holocron Maintain needs Holocron Pro.',
      projectId: 'prj_123',
      origin: 'https://holocron.so',
    })).toMatchInlineSnapshot(`
      {
        "code": "SUBSCRIPTION_REQUIRED",
        "command": "npx -y "@holocron.so/cli" subscribe --project prj_123",
        "error": "This project is on the free plan. Holocron Maintain needs Holocron Pro.",
        "hint": "Subscribe this project to Holocron Pro, then retry.",
        "projectId": "prj_123",
        "upgradeUrl": "https://holocron.so/dashboard/projects/prj_123/billing",
      }
    `)
  })
})
