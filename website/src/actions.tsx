// Server actions for the holocron.so website.
// Extracted into a dedicated file so dashboard.tsx and server.tsx stay
// focused on route definitions and rendering.
'use server'

import { getActionRequest, parseFormData, redirect } from 'spiceflow'
import { router } from 'spiceflow/react'
import { z } from 'zod'
import { getAuth, getBaseUrl, getDb, getProjectSubscription, requireSession } from './db.ts'
import { getOrCreateStripeCustomer, getProPriceId, getStripe } from './lib/stripe.ts'
import type { BillingInterval } from './lib/billing-rules.ts'

const deviceUserCodeSchema = z.object({ userCode: z.string().min(1) })

// ── Device flow actions (used by /device page) ──────────────────────

export async function approveDevice(formData: FormData) {
  const actionRequest = getActionRequest()
  await requireSession(actionRequest)
  const { userCode } = parseFormData(deviceUserCodeSchema, formData)
  const auth = getAuth()
  await auth.api.deviceApprove({ body: { userCode }, headers: actionRequest.headers })
  throw redirect(router.href('/device', { user_code: userCode, status: 'approved' }))
}

export async function denyDevice(formData: FormData) {
  const actionRequest = getActionRequest()
  await requireSession(actionRequest)
  const { userCode } = parseFormData(deviceUserCodeSchema, formData)
  const auth = getAuth()
  await auth.api.deviceDeny({ body: { userCode }, headers: actionRequest.headers })
  throw redirect(router.href('/device', { user_code: userCode, status: 'denied' }))
}

// ── Billing actions (used by /dashboard/projects/:projectId/billing) ─

const checkoutSchema = z.object({
  projectId: z.string().min(1),
  interval: z.enum(['monthly', 'yearly']),
})
const portalSchema = z.object({ projectId: z.string().min(1) })

/** Resolve the caller's session and verify they are an admin of the project's org.
 *  Billing opens the Stripe customer portal for the whole org, so plain members
 *  must not be able to view invoices, change payment methods, or cancel plans. */
async function resolveBillingContext(projectId: string) {
  const actionRequest = getActionRequest()
  const session = await requireSession(actionRequest)
  const db = getDb()
  const project = await db.query.project.findFirst({
    where: { projectId },
  })
  if (!project) throw new Error('Project not found')

  const membership = await db.query.orgMember.findFirst({
    where: { userId: session.userId, orgId: project.orgId },
  })
  if (!membership) throw new Error('Not a member of this organization')
  if (membership.role !== 'admin') throw new Error('Only admins can manage billing')

  const returnUrl = new URL(`/dashboard/projects/${projectId}/billing`, getBaseUrl()).toString()
  return { session, orgId: project.orgId, returnUrl }
}

/** Start a Stripe Checkout for a project subscription. If the project already
 *  has an active subscription, redirect to the billing portal instead so we
 *  never create a duplicate. Subscription metadata carries orgId + projectId so
 *  the webhook can mirror state back to the right project. */
export async function startCheckout(formData: FormData) {
  const { projectId, interval } = parseFormData(checkoutSchema, formData)
  const billingInterval: BillingInterval = interval === 'monthly' ? 'monthly' : 'yearly'
  const { session, orgId, returnUrl } = await resolveBillingContext(projectId)

  const customerId = await getOrCreateStripeCustomer({ orgId, email: session.user.email })
  if (customerId instanceof Error) throw customerId

  const stripe = getStripe()

  const existing = await getProjectSubscription(projectId)
  if (existing) {
    const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
    throw redirect(portal.url)
  }

  const priceId = await getProPriceId(billingInterval)
  if (priceId instanceof Error) throw priceId

  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: returnUrl,
    cancel_url: returnUrl,
    allow_promotion_codes: true,
    client_reference_id: projectId,
    metadata: { orgId, projectId },
    subscription_data: { metadata: { orgId, projectId } },
  })
  if (!checkout.url) throw new Error('Checkout session has no URL')
  throw redirect(checkout.url)
}

/** Open the Stripe Billing Portal for managing an existing subscription. */
export async function openBillingPortal(formData: FormData) {
  const { projectId } = parseFormData(portalSchema, formData)
  const { orgId, returnUrl } = await resolveBillingContext(projectId)

  const customerId = await getOrCreateStripeCustomer({ orgId, email: null })
  if (customerId instanceof Error) throw customerId

  const stripe = getStripe()
  const portal = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl })
  throw redirect(portal.url)
}
