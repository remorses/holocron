---
title: Stripe setup runbook
description: One-time Stripe catalog, portal, webhook, and secret setup for Holocron Pro subscriptions.
---

# Stripe setup runbook

Holocron Pro is a **per-project subscription** at **$99/month** or **$990/year** (two months free). One Stripe customer per `org`, one `subscription` row per `project`. This is the one-time setup to wire it up. Run everything against a **sandbox** first.

> Use `--project-name=holocron-sandbox` (or `holocron-prod`) on every CLI command if you keep multiple Stripe accounts in `~/.config/stripe/config.toml`.

## 1. Create the product and prices

```bash
stripe products create --name="Holocron Pro" --description="Unlimited deployments, previews, and hosted AI chat"
export PRODUCT_ID=prod_xxx   # from the response above
```

Monthly — $99/mo (USD + EUR, same integer):

```bash
stripe prices create \
  --product=$PRODUCT_ID \
  --currency=usd \
  --unit-amount=9900 \
  -d "recurring[interval]=month" \
  -d "currency_options[eur][unit_amount]=9900" \
  -d "lookup_key=pro_monthly" \
  -d "nickname=Holocron Pro Monthly" \
  -d "tax_behavior=exclusive"
```

Yearly — $990/yr (two months free):

```bash
stripe prices create \
  --product=$PRODUCT_ID \
  --currency=usd \
  --unit-amount=99000 \
  -d "recurring[interval]=year" \
  -d "currency_options[eur][unit_amount]=99000" \
  -d "lookup_key=pro_yearly" \
  -d "nickname=Holocron Pro Yearly" \
  -d "tax_behavior=exclusive"
```

Verify:

```bash
stripe prices list --lookup-keys pro_monthly --lookup-keys pro_yearly
```

The code references prices by **lookup key** (`pro_monthly`, `pro_yearly`) defined in `website/src/lib/billing-rules.ts` — no hardcoded price ids.

## 2. Configure the billing portal

```bash
export PRO_MONTHLY=price_xxx   # from step 1
export PRO_YEARLY=price_xxx

stripe billing_portal configurations create \
  -d "business_profile[headline]=Manage your Holocron subscription" \
  -d "features[invoice_history][enabled]=true" \
  -d "features[payment_method_update][enabled]=true" \
  -d "features[customer_update][enabled]=true" \
  -d "features[customer_update][allowed_updates][0]=email" \
  -d "features[customer_update][allowed_updates][1]=address" \
  -d "features[subscription_cancel][enabled]=true" \
  -d "features[subscription_cancel][mode]=at_period_end" \
  -d "features[subscription_update][enabled]=true" \
  -d "features[subscription_update][default_allowed_updates][0]=price" \
  -d "features[subscription_update][default_allowed_updates][1]=promotion_code" \
  -d "features[subscription_update][proration_behavior]=create_prorations" \
  -d "features[subscription_update][products][0][product]=$PRODUCT_ID" \
  -d "features[subscription_update][products][0][prices][0]=$PRO_MONTHLY" \
  -d "features[subscription_update][products][0][prices][1]=$PRO_YEARLY"
```

Listing both prices under the same product is what lets customers switch monthly↔yearly in the portal.

## 3. Secrets

Two server-only secrets (no publishable key — Holocron uses hosted Checkout + Portal redirects, no client Stripe.js):

```bash
# add to sigillo for each env (development / preview / prod)
STRIPE_SECRET_KEY=sk_test_...        # or rk_... restricted key
STRIPE_WEBHOOK_SECRET=whsec_...      # from step 4
```

They are declared in `website/wrangler.jsonc` under `secrets.required` for both production and preview. Dummy values are injected in `website/vitest.config.ts` so imports don't crash in tests.

## 4. Webhook endpoint

The webhook route is `POST /api/stripe/webhook` (`website/src/lib/stripe-webhook.ts`). It reads the raw body and verifies the signature — never add a body schema to it.

Local dev:

```bash
stripe listen --forward-to http://localhost:5173/api/stripe/webhook
# copy the printed whsec_... into STRIPE_WEBHOOK_SECRET
stripe trigger customer.subscription.created
```

Production / preview (run once per environment, capture the returned secret):

```bash
stripe webhook_endpoints create \
  --url="https://holocron.so/api/stripe/webhook" \
  -d "enabled_events[]=customer.subscription.created" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted"
```

## 5. Smoke test

1. `pnpm dev` in `website/` and run `stripe listen` as above.
2. Open `/dashboard/projects/<id>/billing`, click **Subscribe monthly**.
3. Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.
4. Confirm a row appears in the `subscription` D1 table and the billing tab now shows **Active**.
5. Try a 2nd production deploy on a different free project — it should fail with `402 SUBSCRIPTION_REQUIRED`.
