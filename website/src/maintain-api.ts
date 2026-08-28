// Paid model access for portable Holocron documentation maintenance runs.

import { env } from 'cloudflare:workers'
import { json, Spiceflow } from 'spiceflow'
import { ulid } from 'ulid'
import { z } from 'zod'
import { getProjectBillingContext } from './db.ts'
import { resolveCreateDeployAuth, requireDeployAccess } from './deploy-auth.ts'
import { creditsToUsd, monthlyCreditBudget } from './lib/credits.ts'
import type { UsageCounter } from './usage-counter-do.ts'

const MODEL_ID = 'deepseek/deepseek-v4-flash'
const MODEL_NAME = 'deepseek-v4-flash'
const ACCESS_LIFETIME_MS = 30 * 60 * 1000
const VERCEL_API_URL = 'https://api.vercel.com'
const GATEWAY_API_URL = 'https://ai-gateway.vercel.sh'

type GatewayKey = {
  id: string
  apiKeyString: string
}

async function createMaintainModelAccess({ runId, expiresAt }: { runId: string; expiresAt: number }) {
  const response = await fetch(`${VERCEL_API_URL}/v1/api-keys?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.VERCEL_ACCESS_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      purpose: 'ai-gateway',
      name: `holocron-maintain-${runId}`,
      expiresAt,
      aiGatewayQuota: { limitAmount: 1, refreshPeriod: 'none' },
    }),
  })
  if (!response.ok) return new Error(`Vercel key creation failed (${response.status}): ${await response.text()}`)
  const body: GatewayKey = await response.json()
  return body
}

async function readMaintainSpend(keyId: string) {
  const quotaEntityId = `api_key_id_${keyId}`
  const response = await fetch(`${GATEWAY_API_URL}/v1/quotas?quotaEntityId=${encodeURIComponent(quotaEntityId)}`, {
    headers: { authorization: `Bearer ${env.AI_GATEWAY_API_KEY}` },
  })
  if (response.status === 404) return 0
  if (!response.ok) return new Error(`Vercel quota lookup failed (${response.status}): ${await response.text()}`)
  const body: { currentSpend?: number } = await response.json()
  return typeof body.currentSpend === 'number' ? body.currentSpend : 0
}

async function revokeMaintainModelAccess(keyId: string) {
  const response = await fetch(`${VERCEL_API_URL}/v1/api-keys/${encodeURIComponent(keyId)}?teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${env.VERCEL_ACCESS_TOKEN}` },
  })
  if (!response.ok && response.status !== 404) {
    return new Error(`Vercel key revocation failed (${response.status}): ${await response.text()}`)
  }
}

function getMonthStartMs() {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
}

function getUsageStub(orgId: string) {
  const id = env.USAGE_COUNTER.idFromName(orgId)
  return env.USAGE_COUNTER.get(id) as DurableObjectStub<UsageCounter>
}

const createRunBody = z.object({ projectId: z.string().optional() })
const completeRunBody = z.object({
  projectId: z.string(),
  keyId: z.string(),
  reportedCostUsd: z.number().nonnegative(),
})

export const maintainApi = new Spiceflow()
  .route({
    method: 'POST',
    path: '/api/v0/maintain/runs',
    request: createRunBody,
    detail: { hide: true },
    async handler({ request }) {
      const body = createRunBody.parse(await request.json())
      const auth = await resolveCreateDeployAuth(request, body.projectId)
      const billing = await getProjectBillingContext(auth.projectId)
      const isPaid = !!billing.subscription || billing.orgPlan === 'partner'
      if (!isPaid) {
        return json({
          error: 'Holocron Maintain requires an active Pro subscription.',
          code: 'SUBSCRIPTION_REQUIRED',
          upgradeUrl: 'https://holocron.so/docs/pricing',
        }, { status: 402 })
      }

      const limit = await getUsageStub(auth.orgId).checkLimit({
        projectId: auth.projectId,
        sinceMs: getMonthStartMs(),
        usdLimit: creditsToUsd(monthlyCreditBudget({ hasActiveSubscription: !!billing.subscription, isPartner: billing.orgPlan === 'partner' })),
      })
      if (!limit.allowed) return json({ error: 'Monthly AI usage limit reached.' }, { status: 429 })

      const runId = `aut_${ulid()}`
      const expiresAt = Date.now() + ACCESS_LIFETIME_MS
      const access = await createMaintainModelAccess({ runId, expiresAt })
      if (access instanceof Error) throw access
      return {
        runId,
        projectId: auth.projectId,
        gatewayApiKey: access.apiKeyString,
        gatewayKeyId: access.id,
        providerId: 'vercel',
        modelId: MODEL_ID,
        expiresAt,
      }
    },
  })
  .route({
    method: 'POST',
    path: '/api/v0/maintain/runs/:runId/complete',
    params: z.object({ runId: z.string() }),
    request: completeRunBody,
    detail: { hide: true },
    async handler({ request, params }) {
      const body = completeRunBody.parse(await request.json())
      const auth = await requireDeployAccess(request, body.projectId)
      const spend = await readMaintainSpend(body.keyId)
      const revoked = await revokeMaintainModelAccess(body.keyId)
      if (revoked instanceof Error) throw revoked
      if (spend instanceof Error) throw spend
      const costUsd = Math.max(spend, body.reportedCostUsd)
      await getUsageStub(auth.orgId).recordUsage({
        projectId: body.projectId,
        model: MODEL_NAME,
        pageSlug: `maintain:${params.runId}`,
        inputTokens: 0,
        outputTokens: 0,
        costUsd,
      })
      return { completed: true, costUsd }
    },
  })
