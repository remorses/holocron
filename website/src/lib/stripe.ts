// Stripe helpers: client construction, customer management, price lookup, and
// the subscription webhook handler that mirrors Stripe state into D1.
//
// Errors are returned as values (errore) — every Stripe/Drizzle boundary is
// wrapped in a tagged error and callers check `instanceof Error`. The ONLY
// place that creates a Stripe customer is getOrCreateStripeCustomer, so we
// never end up with duplicate customers per org.
//
// One Stripe customer per org (org.stripeCustomerId), one subscription row per
// project (subscription.projectId). The project is the unit a customer pays to
// unlock, so gating keys off subscription.projectId.

import Stripe from 'stripe'
import * as orm from 'drizzle-orm'
import * as schema from 'db/schema'
import * as errore from 'errore'
import { captureException } from '@strada.sh/sdk'
import { env } from 'cloudflare:workers'
import { getDb } from '../db.ts'
import { PRO_PRICE_LOOKUP_KEYS, type BillingInterval } from './billing-rules.ts'

// ── Tagged errors ───────────────────────────────────────────────────

export class StripeApiError extends errore.createTaggedError({
  name: 'StripeApiError',
  message: 'Stripe API call failed: $operation',
}) {}

export class DbError extends errore.createTaggedError({
  name: 'DbError',
  message: 'Database operation failed: $operation',
}) {}

export class OrgNotFoundError extends errore.createTaggedError({
  name: 'OrgNotFoundError',
  message: 'Org $orgId not found',
}) {}

export class PriceNotFoundError extends errore.createTaggedError({
  name: 'PriceNotFoundError',
  message: 'No Stripe price found for lookup key $lookupKey',
}) {}

// ── Stripe client (with a test seam) ────────────────────────────────

let stripeOverride: Stripe | null = null

/** Test-only seam: inject a fake Stripe client so webhook/customer logic can be
 *  exercised against a real D1 without hitting the live Stripe API. Pass null to
 *  reset back to the real client. */
export function __setStripeForTests(client: Stripe | null): void {
  stripeOverride = client
}

export function getStripe(): Stripe {
  if (stripeOverride) return stripeOverride
  // The default fetch-based HTTP client works inside Cloudflare Workers.
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  })
}

// ── Customer management ─────────────────────────────────────────────

/** Get or create the Stripe customer for an org. Idempotent and the single
 *  source of truth — never call stripe.customers.create anywhere else. Writes
 *  metadata.orgId so webhooks can always resolve the org from the customer. */
export async function getOrCreateStripeCustomer(opts: {
  orgId: string
  email: string | null | undefined
}): Promise<string | DbError | OrgNotFoundError | StripeApiError> {
  const db = getDb()
  const org = await db.query.org
    .findFirst({ where: { id: opts.orgId } })
    .catch((e) => new DbError({ operation: 'org.findFirst', cause: e }))
  if (org instanceof Error) return org
  if (!org) return new OrgNotFoundError({ orgId: opts.orgId })

  if (org.stripeCustomerId) return org.stripeCustomerId

  const stripe = getStripe()
  const customer = await stripe.customers
    .create({ email: opts.email || undefined, metadata: { orgId: opts.orgId } })
    .catch((e) => new StripeApiError({ operation: 'customers.create', cause: e }))
  if (customer instanceof Error) return customer

  const updated = await db
    .update(schema.org)
    .set({ stripeCustomerId: customer.id, updatedAt: Date.now() })
    .where(orm.eq(schema.org.id, opts.orgId))
    .limit(1)
    .catch((e) => new DbError({ operation: 'org.update', cause: e }))
  if (DbError.is(updated)) return updated

  return customer.id
}

// ── Price lookup ────────────────────────────────────────────────────

export type ProPrice = {
  interval: BillingInterval
  priceId: string
  productId: string
  unitAmount: number | null
  currency: string
}

/** Fetch the Holocron Pro prices by lookup key. References stable lookup keys
 *  rather than hardcoded price ids so prices can be rotated without redeploys. */
export async function getProPrices(): Promise<ProPrice[] | StripeApiError | PriceNotFoundError> {
  const stripe = getStripe()
  const lookupKeys = Object.values(PRO_PRICE_LOOKUP_KEYS)
  const list = await stripe.prices
    .list({ lookup_keys: lookupKeys, active: true, expand: ['data.product'] })
    .catch((e) => new StripeApiError({ operation: 'prices.list', cause: e }))
  if (list instanceof Error) return list

  const byLookup = new Map(list.data.map((p) => [p.lookup_key, p]))
  const prices: ProPrice[] = []
  for (const interval of Object.keys(PRO_PRICE_LOOKUP_KEYS) as BillingInterval[]) {
    const price = byLookup.get(PRO_PRICE_LOOKUP_KEYS[interval])
    if (!price) return new PriceNotFoundError({ lookupKey: PRO_PRICE_LOOKUP_KEYS[interval] })
    prices.push({
      interval,
      priceId: price.id,
      productId: typeof price.product === 'string' ? price.product : price.product.id,
      unitAmount: price.unit_amount,
      currency: price.currency,
    })
  }
  return prices
}

export async function getProPriceId(
  interval: BillingInterval,
): Promise<string | StripeApiError | PriceNotFoundError> {
  const prices = await getProPrices()
  if (prices instanceof Error) return prices
  const match = prices.find((p) => p.interval === interval)
  if (!match) return new PriceNotFoundError({ lookupKey: PRO_PRICE_LOOKUP_KEYS[interval] })
  return match.priceId
}

// ── Webhook handler: mirror subscription state into D1 ──────────────

/** Re-fetch the latest subscription, resolve its orgId+projectId, and upsert
 *  the local subscription row. Idempotent on subscriptionId so at-least-once
 *  webhook delivery is safe. */
export async function handleSubscriptionChange(
  sub: Stripe.Subscription,
): Promise<null | StripeApiError | DbError | OrgNotFoundError> {
  const stripe = getStripe()
  const latest = await stripe.subscriptions
    .retrieve(sub.id)
    .catch((e) => new StripeApiError({ operation: 'subscriptions.retrieve', cause: e }))
  if (latest instanceof Error) return latest

  const ids = await resolveSubscriptionIds(latest)
  if (ids instanceof Error) return ids
  if (ids === null) {
    captureException(new Error(`dropping subscription ${latest.id}: could not resolve org/project`), {
      tags: { route: 'stripe-webhook', subscriptionId: latest.id },
    })
    return null
  }

  const firstItem = latest.items.data[0]
  if (!firstItem) {
    captureException(new Error(`subscription ${latest.id} has no items`), {
      tags: { route: 'stripe-webhook', subscriptionId: latest.id },
    })
    return null
  }

  const price = firstItem.price
  const intervalRaw = price.recurring?.interval
  const interval = intervalRaw === 'month' || intervalRaw === 'year' ? intervalRaw : null
  const periodEnd = firstItem.current_period_end

  const record: typeof schema.subscription.$inferInsert = {
    subscriptionId: latest.id,
    orgId: ids.orgId,
    projectId: ids.projectId,
    customerId: typeof latest.customer === 'string' ? latest.customer : latest.customer.id,
    priceId: price.id,
    productId: typeof price.product === 'string' ? price.product : price.product.id,
    status: latest.status,
    interval,
    currentPeriodEnd: periodEnd ? periodEnd * 1000 : null,
    cancelAtPeriodEnd: latest.cancel_at_period_end,
    updatedAt: Date.now(),
  }

  const db = getDb()
  const upsert = await db
    .insert(schema.subscription)
    .values(record)
    .onConflictDoUpdate({ target: schema.subscription.subscriptionId, set: record })
    .catch((e) => new DbError({ operation: 'subscription.upsert', cause: e }))
  if (DbError.is(upsert)) return upsert

  return null
}

/** Resolve orgId + projectId for a subscription. Primary path is metadata set at
 *  checkout time (on both the session and subscription_data). Fallback: the
 *  customer's metadata.orgId (always written by getOrCreateStripeCustomer) plus
 *  the customer's only project — but we require projectId from metadata, so a
 *  missing projectId drops the event rather than guessing. */
async function resolveSubscriptionIds(
  sub: Stripe.Subscription,
): Promise<{ orgId: string; projectId: string } | null | DbError> {
  const metaOrgId = sub.metadata?.orgId
  const metaProjectId = sub.metadata?.projectId
  if (metaOrgId && metaProjectId) {
    const db = getDb()
    const project = await db.query.project
      .findFirst({ where: { projectId: metaProjectId, orgId: metaOrgId } })
      .catch((e) => new DbError({ operation: 'project.findFirst', cause: e }))
    if (project instanceof Error) return project
    if (project) return { orgId: metaOrgId, projectId: metaProjectId }
    captureException(new Error(`subscription ${sub.id} metadata points at unknown org/project`), {
      tags: { route: 'stripe-webhook', subscriptionId: sub.id },
    })
  }
  return null
}
